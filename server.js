const express = require("express");
const fs = require("fs/promises");
const path = require("path");

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

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/favicon.ico", express.static(path.join(__dirname, "public", "favicon.ico")));

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeProfiles(profiles) {
  await ensureProfilesStore();
  await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2), "utf8");
}

function normalizeProfile(payload) {
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
    name: String(payload.name || "Untitled profile").trim(),
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

app.get("/api/profiles", async (_req, res) => {
  const profiles = await readProfiles();
  const summary = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    updatedAt: profile.updatedAt
  }));

  res.json(summary);
});

app.get("/api/profiles/:id", async (req, res) => {
  const profiles = await readProfiles();
  const profile = profiles.find((item) => item.id === req.params.id);

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  res.json(profile);
});

app.post("/api/profiles", async (req, res) => {
  const payload = req.body || {};

  if (!payload.name) {
    res.status(400).json({ message: "Profile name is required" });
    return;
  }

  const profiles = await readProfiles();
  const now = new Date().toISOString();
  const profile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    ...normalizeProfile(payload)
  };

  profiles.push(profile);
  await writeProfiles(profiles);

  res.status(201).json(profile);
});

app.put("/api/profiles/:id", async (req, res) => {
  const profiles = await readProfiles();
  const index = profiles.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const current = profiles[index];
  const updated = {
    ...current,
    ...normalizeProfile(req.body || {}),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  };

  profiles[index] = updated;
  await writeProfiles(profiles);

  res.json(updated);
});

app.delete("/api/profiles/:id", async (req, res) => {
  const profiles = await readProfiles();
  const nextProfiles = profiles.filter((item) => item.id !== req.params.id);

  if (nextProfiles.length === profiles.length) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  await writeProfiles(nextProfiles);
  res.status(204).send();
});

app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureProfilesStore()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Gliding weight and balance server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize profile store", error);
    process.exit(1);
  });
