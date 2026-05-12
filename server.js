const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { getWebAuthConfig, requireAuth, tryGetAuthUser } = require("./auth/identityPlatform");
const firestore = require("./db/firestore");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const profilesPath = path.join(dataDir, "profiles.json");

function normalizeWeightFactor(value) {
  const factor = Number(value);
  if (!Number.isFinite(factor)) {
    return 1;
  }

  return Math.min(1, Math.max(0, factor));
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
        waterBallast: Boolean(item.waterBallast)
      }))
    : Array.isArray(payload.stations)
      ? payload.stations.map((station) => ({
          name: String(station.name || "Item").trim(),
          weight: Number(station.weight) || 0,
          arm: Number(station.arm) || 0,
          weightFactor: normalizeWeightFactor(station.weightFactor),
          permanent: Boolean(station.permanent),
          waterBallast: Boolean(station.waterBallast)
        }))
      : [];

  const aircraft = payload.aircraft || {};
  const itemDefinitions = Array.isArray(aircraft.itemDefinitions)
    ? aircraft.itemDefinitions.map((item) => ({
        name: String(item.name || "Item").trim(),
        arm: Number(item.arm) || 0,
        weightFactor: normalizeWeightFactor(item.weightFactor),
        permanent: Boolean(item.permanent),
        waterBallast: Boolean(item.waterBallast)
      }))
    : Array.isArray(aircraft.stationDefinitions)
      ? aircraft.stationDefinitions.map((station) => ({
          name: String(station.name || "Item").trim(),
          arm: Number(station.arm) || 0,
          weightFactor: normalizeWeightFactor(station.weightFactor),
          permanent: Boolean(station.permanent),
          waterBallast: Boolean(station.waterBallast)
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
          waterBallast: item.waterBallast
        }));

  const persistedItemDefinitions =
    itemDefinitions.length > 0
      ? itemDefinitions
      : stations.map((item) => ({
          name: item.name,
          arm: item.arm,
          weightFactor: normalizeWeightFactor(item.weightFactor),
          permanent: Boolean(item.permanent),
          waterBallast: Boolean(item.waterBallast)
        }));

  return {
    name: normalizedName,
    isDefault: isDefaultProfileName(normalizedName),
    aircraft: {
      emptyWeight: Number(aircraft.emptyWeight) || 0,
      emptyArm: Number(aircraft.emptyArm) || 0,
      wingArea: Number(aircraft.wingArea) || 0,
      maxWeight: Number(aircraft.maxWeight) || 0,
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
