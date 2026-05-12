const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

const DB_NAME = "gliding-weight-balance";
const COLLECTION_NAME = "profiles";

let firestoreReady = false;
let firestoreDb = null;

function buildProfileDocumentId(userId, profileName) {
  return `${String(userId || "").trim()}_${String(profileName || "").trim()}`.replaceAll("/", "_");
}

function parseServiceAccountJson(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && parsed.client_email && parsed.private_key) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function readServiceAccountFromEnv() {
  const raw = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (!raw) {
    return null;
  }

  // Support direct JSON content.
  const inlineJson = parseServiceAccountJson(raw);
  if (inlineJson) {
    return inlineJson;
  }

  // Support JSON file path content.
  if (fs.existsSync(raw)) {
    try {
      const fileJson = fs.readFileSync(raw, "utf8");
      return parseServiceAccountJson(fileJson);
    } catch {
      return null;
    }
  }

  // Support base64-encoded service account JSON.
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return parseServiceAccountJson(decoded);
  } catch {
    return null;
  }
}

function getDb() {
  if (!firestoreReady) {
    throw new Error("Firestore not initialized");
  }

  return firestoreDb;
}

function initializeFirestore() {
  if (firestoreReady) {
    return;
  }

  // Initialize Firebase Admin if not already done
  if (admin.apps.length === 0) {
    const projectId = process.env.GCIP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || undefined;
    const serviceAccount = readServiceAccountFromEnv();
    const options = { projectId };

    if (serviceAccount) {
      options.credential = admin.credential.cert(serviceAccount);
    }

    admin.initializeApp(options);
    console.log("Firebase Admin initialized for Firestore");
  }

  firestoreDb = getFirestore(admin.app(), DB_NAME);
  firestoreReady = true;
}

async function listProfilesByUserId(userId) {
  initializeFirestore();

  const db = getDb();
  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("userId", "==", userId)
    .get();

  const profiles = [];
  snapshot.forEach((doc) => {
    profiles.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return profiles;
}

async function getProfileById(docId, userId) {
  initializeFirestore();

  const db = getDb();
  const doc = await db.collection(COLLECTION_NAME).doc(docId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();

  // Verify ownership
  if (data.userId !== userId) {
    return null;
  }

  return {
    id: doc.id,
    ...data
  };
}

async function createProfile(profileData, userId) {
  initializeFirestore();

  const db = getDb();
  const now = new Date().toISOString();
  const docId = buildProfileDocumentId(userId, profileData.name);
  const docRef = db.collection(COLLECTION_NAME).doc(docId);
  const existingDoc = await docRef.get();

  if (existingDoc.exists) {
    const error = new Error("Profile already exists");
    error.code = "PROFILE_EXISTS";
    throw error;
  }

  const docData = {
    ...profileData,
    userId,
    createdAt: now,
    updatedAt: now
  };

  await docRef.set(docData);

  return {
    id: docId,
    ...docData
  };
}

async function updateProfile(docId, profileData, userId) {
  initializeFirestore();

  const db = getDb();
  const currentDocRef = db.collection(COLLECTION_NAME).doc(docId);
  const doc = await currentDocRef.get();

  if (!doc.exists) {
    return null;
  }

  const existing = doc.data();

  // Verify ownership
  if (existing.userId !== userId) {
    return null;
  }

  const updated = {
    ...existing,
    ...profileData,
    userId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };

  const nextDocId = buildProfileDocumentId(userId, updated.name);

  if (nextDocId === docId) {
    await currentDocRef.set(updated);

    return {
      id: docId,
      ...updated
    };
  }

  const nextDocRef = db.collection(COLLECTION_NAME).doc(nextDocId);
  const nextDoc = await nextDocRef.get();

  if (nextDoc.exists) {
    const error = new Error("Profile already exists");
    error.code = "PROFILE_EXISTS";
    throw error;
  }

  await nextDocRef.set(updated);
  await currentDocRef.delete();

  return {
    id: nextDocId,
    ...updated
  };
}

async function deleteProfile(docId, userId) {
  initializeFirestore();

  const db = getDb();
  const docRef = db.collection(COLLECTION_NAME).doc(docId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return false;
  }

  const existing = doc.data();

  // Verify ownership
  if (existing.userId !== userId) {
    return false;
  }

  // Prevent deletion of default profiles
  if (existing.isDefault || String(existing.name || "").trim() === "D-KLDO") {
    return false;
  }

  await docRef.delete();
  return true;
}

module.exports = {
  listProfilesByUserId,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  initializeFirestore
};
