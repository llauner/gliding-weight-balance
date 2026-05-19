const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { getWebAuthConfig, requireAuth, tryGetAuthUser } = require("./auth/identityPlatform");
const firestore = require("./db/firestore");
const { buildProfileQrPdf, buildProfileQrFileName } = require("./services/profileQrPdf");

const app = express();
const PORT = process.env.PORT || 3000;
const packageVersion = require("./package.json").version;
const GITHUB_TAGS_API_URL = "https://api.github.com/repos/llauner/gliding-weight-balance/tags?per_page=1";
const APP_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
let appVersionCache = {
  value: process.env.APP_VERSION || packageVersion || "unknown",
  fetchedAt: 0
};

const dataDir = path.join(__dirname, "data");
const profilesPath = path.join(dataDir, "profiles.json");

function normalizeWeightFactor(value) {
  const factor = Number(value);
  if (!Number.isFinite(factor)) {
    return 1;
  }

  return Math.min(10, Math.max(0, factor));
}

function isDefaultProfileName(name) {
  return String(name || "").trim() === "D-KLDO";
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/favicon.ico", express.static(path.join(__dirname, "public", "favicon.ico")));

app.get("/api/auth/config", (_req, res) => {
  const config = getWebAuthConfig();
  if (!config) {
    res.json({ enabled: false });
    return;
  }

  res.json({ enabled: true, config });
});

async function fetchLatestAppVersion() {
  const now = Date.now();
  if (appVersionCache.fetchedAt > 0 && (now - appVersionCache.fetchedAt) < APP_VERSION_CACHE_TTL_MS) {
    return appVersionCache.value;
  }

  try {
    const response = await fetch(GITHUB_TAGS_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "gliding-weight-balance"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub tags request failed: ${response.status}`);
    }

    const tags = await response.json();
    const latestTagName = Array.isArray(tags) && tags[0] && typeof tags[0].name === "string"
      ? tags[0].name.trim()
      : "";

    if (!latestTagName) {
      throw new Error("GitHub tags response did not contain a valid tag name");
    }

    process.env.APP_VERSION = latestTagName;
    appVersionCache = {
      value: latestTagName,
      fetchedAt: now
    };
    return latestTagName;
  } catch (error) {
    console.warn("Unable to fetch latest GitHub tag for APP_VERSION:", error.message || error);
    const fallbackValue = process.env.APP_VERSION || appVersionCache.value || packageVersion || "unknown";
    appVersionCache = {
      value: fallbackValue,
      fetchedAt: now
    };
    return fallbackValue;
  }
}

app.get("/api/version", async (_req, res) => {
  const appVersion = await fetchLatestAppVersion();
  res.json({ appVersion });
});

// Optional auth middleware - attaches user if authenticated, but doesn't require it
const optionalAuth = tryGetAuthUser;

async function ensureProfilesStore() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(profilesPath);
  } catch {
    await fs.writeFile(profilesPath, "[]", "utf8");
  }
}

async function readProfiles() {
  await ensureProfilesStore();
  const raw = await fs.readFile(profilesPath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((profile) => ({
      ...profile,
      isDefault: Boolean(profile.isDefault) || isDefaultProfileName(profile.name)
    }));
  } catch {
    return [];
  }
}

async function writeProfiles(profiles) {
  await ensureProfilesStore();
  await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2), "utf8");
}

function normalizeProfile(payload) {
  const normalizedName = String(payload.name || "Untitled profile").trim();
  const rawItems = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        name: String(item.name || "Item").trim(),
        weight: Number(item.weight) || 0,
        arm: Number(item.arm) || 0,
        weightFactor: normalizeWeightFactor(item.weightFactor),
        permanent: Boolean(item.permanent),
        waterBallast: Boolean(item.waterBallast),
        isFrontSeat: Boolean(item.isFrontSeat)
      }))
    : Array.isArray(payload.stations)
      ? payload.stations.map((station) => ({
          name: String(station.name || "Item").trim(),
          weight: Number(station.weight) || 0,
          arm: Number(station.arm) || 0,
          weightFactor: normalizeWeightFactor(station.weightFactor),
          permanent: Boolean(station.permanent),
          waterBallast: Boolean(station.waterBallast),
          isFrontSeat: Boolean(station.isFrontSeat)
        }))
      : [];

  const aircraft = payload.aircraft || {};
  const itemDefinitions = Array.isArray(aircraft.itemDefinitions)
    ? aircraft.itemDefinitions.map((item) => ({
        name: String(item.name || "Item").trim(),
        arm: Number(item.arm) || 0,
        weightFactor: normalizeWeightFactor(item.weightFactor),
        permanent: Boolean(item.permanent),
        waterBallast: Boolean(item.waterBallast),
        isFrontSeat: Boolean(item.isFrontSeat)
      }))
    : Array.isArray(aircraft.stationDefinitions)
      ? aircraft.stationDefinitions.map((station) => ({
          name: String(station.name || "Item").trim(),
          arm: Number(station.arm) || 0,
          weightFactor: normalizeWeightFactor(station.weightFactor),
          permanent: Boolean(station.permanent),
          waterBallast: Boolean(station.waterBallast),
          isFrontSeat: Boolean(station.isFrontSeat)
        }))
      : [];

  const stations =
    rawItems.length > 0
      ? rawItems
      : itemDefinitions.map((item) => ({
          name: item.name,
          arm: item.arm,
          weight: 0,
          weightFactor: item.weightFactor,
          permanent: item.permanent,
          waterBallast: item.waterBallast,
          isFrontSeat: Boolean(item.isFrontSeat)
        }));

  const persistedItemDefinitions =
    itemDefinitions.length > 0
      ? itemDefinitions
      : stations.map((item) => ({
          name: item.name,
          arm: item.arm,
          weightFactor: normalizeWeightFactor(item.weightFactor),
          permanent: Boolean(item.permanent),
          waterBallast: Boolean(item.waterBallast),
          isFrontSeat: Boolean(item.isFrontSeat)
        }));

  return {
    name: normalizedName,
    isDefault: Boolean(payload.isDefault),
    isPublic: Boolean(payload.isPublic),
    aircraft: {
      emptyWeight: Number(aircraft.emptyWeight) || 0,
      emptyArm: Number(aircraft.emptyArm) || 0,
      wingArea: Number(aircraft.wingArea) || 0,
      maxWeight: Number(aircraft.maxWeight) || 0,
      maxPayloadInFuselage: Number(aircraft.maxPayloadInFuselage) || 0,
      minCg: Number(aircraft.minCg) || 0,
      maxCg: Number(aircraft.maxCg) || 0,
      idealMinCg: Number(aircraft.idealMinCg) || 420,
      idealMaxCg: Number(aircraft.idealMaxCg) || 480,
      itemDefinitions: persistedItemDefinitions,
      stationDefinitions: persistedItemDefinitions
    },
    items: stations,
    stations
  };
}

app.get("/api/profiles", optionalAuth, async (req, res) => {
  try {
    let profiles;

    if (req.user) {
      // Authenticated: get profiles from Firestore
      profiles = await firestore.listProfilesByUserId(req.user.email);
    } else {
      // Unauthenticated: get default profiles from JSON
      profiles = await readProfiles();
    }

    const summary = profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      updatedAt: profile.updatedAt,
      isDefault: Boolean(profile.isDefault)
    }));

    res.json(summary);
  } catch (error) {
    console.error("Error listing profiles:", error);
    res.status(500).json({ message: "Failed to list profiles" });
  }
});

app.get("/api/profiles/:id", optionalAuth, async (req, res) => {
  try {
    let profile;

    if (req.user) {
      // Authenticated: get from Firestore
      profile = await firestore.getProfileById(req.params.id, req.user.email);
      if (!profile) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
    } else {
      // Unauthenticated: get from JSON
      const profiles = await readProfiles();
      profile = profiles.find((item) => item.id === req.params.id);
      if (!profile) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
    }

    res.json(profile);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ message: "Failed to get profile" });
  }
});

app.get("/api/profiles/:id/public", async (req, res) => {
  try {
    const profile = await firestore.getPublicProfileById(req.params.id);
    if (!profile) {
      res.status(404).json({ message: "Public profile not found" });
      return;
    }
    res.json(profile);
  } catch (error) {
    console.error("Error getting public profile:", error);
    res.status(500).json({ message: "Failed to get public profile" });
  }
});

app.post("/api/profiles", requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.name) {
      res.status(400).json({ message: "Profile name is required" });
      return;
    }

    const normalized = normalizeProfile(payload);
    const profile = await firestore.createProfile(normalized, req.user.email);

    res.status(201).json(profile);
  } catch (error) {
    if (error && error.code === "PROFILE_EXISTS") {
      res.status(409).json({ message: "Profile already exists" });
      return;
    }

    console.error("Error creating profile:", error);
    res.status(500).json({ message: "Failed to create profile" });
  }
});

app.put("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    const normalized = normalizeProfile(req.body || {});
    const profile = await firestore.updateProfile(req.params.id, normalized, req.user.email);

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (error) {
    if (error && error.code === "PROFILE_EXISTS") {
      res.status(409).json({ message: "Profile already exists" });
      return;
    }

    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

app.delete("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    const success = await firestore.deleteProfile(req.params.id, req.user.email);

    if (!success) {
      res.status(404).json({ message: "Profile not found or cannot be deleted" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).json({ message: "Failed to delete profile" });
  }
});

app.get("/api/profiles/:id/qrcode", optionalAuth, async (req, res) => {
  try {
    const profileId = String(req.params.id || "").trim();
    if (!profileId) {
      res.status(400).json({ message: "Profile id is required" });
      return;
    }

    let profile = null;
    if (req.user) {
      profile = await firestore.getProfileById(profileId, req.user.email);
    } else {
      const profiles = await readProfiles();
      profile = profiles.find((item) => item.id === profileId) || null;
    }

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const isPublic = Boolean(profile.isPublic);
    if (!isPublic) {
      res.status(400).json({ message: "Profile must be public before creating a QR code" });
      return;
    }

    const profileUrl = `${req.protocol}://${req.get("host")}/?profileId=${encodeURIComponent(profileId)}`;
    const pdfBuffer = await buildProfileQrPdf(profile.name, profileUrl);
    const fileName = buildProfileQrFileName(profile.name);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error creating profile QR code:", error);
    res.status(500).json({ message: "Failed to create QR code" });
  }
});

app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function initializeServices() {
  // Initialize JSON profile store
  await ensureProfilesStore();

  // Initialize Firestore
  firestore.initializeFirestore();
  console.log("Firestore initialized");
}

initializeServices()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Gliding weight and balance server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize services", error);
    process.exit(1);
  });
