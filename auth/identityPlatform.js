const admin = require("firebase-admin");
const fs = require("fs");

let identityPlatformReady = false;

const firebaseWebConfig = {
  apiKey: process.env.GCIP_API_KEY || "",
  authDomain: process.env.GCIP_AUTH_DOMAIN || "",
  projectId: process.env.GCIP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "",
  appId: process.env.GCIP_APP_ID || ""
};

function getWebAuthConfig() {
  if (!firebaseWebConfig.apiKey || !firebaseWebConfig.authDomain || !firebaseWebConfig.projectId) {
    return null;
  }

  return {
    apiKey: firebaseWebConfig.apiKey,
    authDomain: firebaseWebConfig.authDomain,
    projectId: firebaseWebConfig.projectId,
    appId: firebaseWebConfig.appId || undefined
  };
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

function ensureIdentityPlatform() {
  if (identityPlatformReady) {
    return true;
  }

  if (admin.apps.length === 0) {
    const projectId = firebaseWebConfig.projectId || undefined;
    const serviceAccount = readServiceAccountFromEnv();
    const options = { projectId };

    if (serviceAccount) {
      options.credential = admin.credential.cert(serviceAccount);
    }

    admin.initializeApp(options);
  }

  identityPlatformReady = true;
  return true;
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    ensureIdentityPlatform();
    req.user = await admin.auth().verifyIdToken(token);
    console.log("Authenticated user", {
      uid: req.user.uid,
      email: req.user.email || null,
      name: req.user.name || null,
      provider: req.user.firebase && req.user.firebase.sign_in_provider ? req.user.firebase.sign_in_provider : null,
      authTime: req.user.auth_time || null
    });
    next();
  } catch (error) {
    console.error("Authentication verification failed", error.message || error);
    res.status(401).json({ message: "Unauthorized" });
  }
}

async function tryGetAuthUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    // No auth header, continue without user
    next();
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    // Empty token, continue without user
    next();
    return;
  }

  try {
    ensureIdentityPlatform();
    req.user = await admin.auth().verifyIdToken(token);
    console.log("Authenticated user", {
      uid: req.user.uid,
      email: req.user.email || null,
      name: req.user.name || null,
      provider: req.user.firebase && req.user.firebase.sign_in_provider ? req.user.firebase.sign_in_provider : null,
      authTime: req.user.auth_time || null
    });
  } catch (error) {
    // Token verification failed, but we don't error out - just continue without user
    console.warn("Token verification failed (optional auth)", error.message || error);
  }

  next();
}

module.exports = {
  getWebAuthConfig,
  requireAuth,
  tryGetAuthUser
};
