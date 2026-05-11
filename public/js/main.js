import {
  calculateTotals,
  envelopePolygon,
  evaluateBalance
} from "./calculations.js";
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  updateProfile
} from "./api.js";

const elements = {
  profileName: document.querySelector("#profileName"),
  profileSelect: document.querySelector("#profileSelect"),
  saveProfileBtn: document.querySelector("#saveProfileBtn"),
  updateProfileBtn: document.querySelector("#updateProfileBtn"),
  loadProfileBtn: document.querySelector("#loadProfileBtn"),
  deleteProfileBtn: document.querySelector("#deleteProfileBtn"),
  statusText: document.querySelector("#statusText"),
  emptyWeight: document.querySelector("#emptyWeight"),
  emptyArm: document.querySelector("#emptyArm"),
  wingArea: document.querySelector("#wingArea"),
  maxWeight: document.querySelector("#maxWeight"),
  minCg: document.querySelector("#minCg"),
  maxCg: document.querySelector("#maxCg"),
  idealMinCg: document.querySelector("#idealMinCg"),
  idealMaxCg: document.querySelector("#idealMaxCg"),
  totalWeightValue: document.querySelector("#totalWeightValue"),
  wingLoadingValue: document.querySelector("#wingLoadingValue"),
  cgValue: document.querySelector("#cgValue"),
  balanceStatusValue: document.querySelector("#balanceStatusValue"),
  itemsBody: document.querySelector("#itemsBody"),
  permanentItemsBody: document.querySelector("#permanentItemsBody"),
  itemRowTemplate: document.querySelector("#itemRowTemplate"),
  itemDefinitionsBody: document.querySelector("#itemDefinitionsBody"),
  itemDefinitionRowTemplate: document.querySelector("#itemDefinitionRowTemplate"),
  addItemDefinitionBtn: document.querySelector("#addItemDefinitionBtn"),
  envelopeCanvas: document.querySelector("#envelopeCanvas")
};

const state = {
  selectedProfileId: ""
};

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function numberValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function clampWeightFactor(value) {
  return Math.min(1, Math.max(0, value));
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "#a4161a" : "#6a5850";
}

function cgPercentWithinLimits(aircraft, cg) {
  const minCg = Number(aircraft.minCg);
  const maxCg = Number(aircraft.maxCg);

  if (!Number.isFinite(minCg) || !Number.isFinite(maxCg) || maxCg <= minCg) {
    return null;
  }

  return ((cg - minCg) / (maxCg - minCg)) * 100;
}

function aircraftFromForm() {
  return {
    emptyWeight: numberValue(elements.emptyWeight),
    emptyArm: numberValue(elements.emptyArm),
    wingArea: numberValue(elements.wingArea),
    maxWeight: numberValue(elements.maxWeight),
    minCg: numberValue(elements.minCg),
    maxCg: numberValue(elements.maxCg),
    idealMinCg: numberValue(elements.idealMinCg),
    idealMaxCg: numberValue(elements.idealMaxCg),
    itemDefinitions: itemDefinitionsFromForm()
  };
}

function itemDefinitionsFromForm() {
  const rows = [...elements.itemDefinitionsBody.querySelectorAll("tr")];
  return rows.map((row) => ({
    id: row.dataset.definitionId || createId("def"),
    name: row.querySelector('[data-field="name"]').value.trim() || "Item",
    arm: numberValue(row.querySelector('[data-field="arm"]')),
    weightFactor: clampWeightFactor(numberValue(row.querySelector('[data-field="weightFactor"]'))),
    permanent: row.querySelector('[data-field="permanent"]').checked
  }));
}

function itemWeightsByDefinitionIdFromForm() {
  const weightMap = new Map();
  const rows = [
    ...elements.itemsBody.querySelectorAll("tr"),
    ...elements.permanentItemsBody.querySelectorAll("tr")
  ];
  rows.forEach((row) => {
    const definitionId = row.dataset.definitionId;
    if (!definitionId) {
      return;
    }

    weightMap.set(definitionId, numberValue(row.querySelector('[data-field="weight"]')));
  });

  return weightMap;
}

function combinedItemsFromForm() {
  const definitions = itemDefinitionsFromForm();
  const weightMap = itemWeightsByDefinitionIdFromForm();

  return definitions.map((definition) => ({
    name: definition.name,
    arm: definition.arm,
    weight: weightMap.get(definition.id) ?? 0,
    weightFactor: definition.weightFactor,
    permanent: definition.permanent
  }));
}

function itemsFromForm() {
  return combinedItemsFromForm();
}

function renderItemRows(definitions, existingWeights = new Map()) {
  const weightFor = (definitionId, index) => {
    if (existingWeights instanceof Map) {
      return existingWeights.get(definitionId) ?? 0;
    }

    if (Array.isArray(existingWeights)) {
      return existingWeights[index] ?? 0;
    }

    return 0;
  };

  elements.itemsBody.textContent = "";
  elements.permanentItemsBody.textContent = "";

  definitions.forEach((definition, index) => {
    const fragment = elements.itemRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector("tr");
    row.dataset.definitionId = definition.id || createId("def");
    row.querySelector(".item-name").textContent = definition.name;
    row.querySelector('[data-field="weight"]').value = weightFor(definition.id, index);
    row.addEventListener("input", recalculateAndRender);
    if (definition.permanent) {
      elements.permanentItemsBody.appendChild(row);
    } else {
      elements.itemsBody.appendChild(row);
    }
  });
}

function syncItemsFromDefinitions() {
  const existingWeights = itemWeightsByDefinitionIdFromForm();
  const definitions = itemDefinitionsFromForm();
  renderItemRows(definitions, existingWeights);
}

function handleItemDefinitionDragOver(event) {
  event.preventDefault();
  const draggingRow = elements.itemDefinitionsBody.querySelector("tr.dragging");
  if (!draggingRow) {
    return;
  }

  const targetRow = event.target.closest("tr");
  if (!targetRow || targetRow === draggingRow || targetRow.parentElement !== elements.itemDefinitionsBody) {
    return;
  }

  const rect = targetRow.getBoundingClientRect();
  const insertBefore = event.clientY < rect.top + rect.height / 2;

  if (insertBefore) {
    elements.itemDefinitionsBody.insertBefore(draggingRow, targetRow);
  } else {
    elements.itemDefinitionsBody.insertBefore(draggingRow, targetRow.nextSibling);
  }
}

function profilePayload() {
  return {
    name: elements.profileName.value.trim(),
    aircraft: aircraftFromForm(),
    items: itemsFromForm()
  };
}

function addItemDefinitionRow(item = { name: "", arm: 0, weightFactor: 1, permanent: false }) {
  const fragment = elements.itemDefinitionRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");
  const definitionId = item.id || createId("def");

  row.dataset.definitionId = definitionId;

  row.querySelector('[data-field="name"]').value = item.name ?? "";
  row.querySelector('[data-field="arm"]').value = item.arm ?? 0;
  row.querySelector('[data-field="weightFactor"]').value = clampWeightFactor(item.weightFactor ?? 1);
  row.querySelector('[data-field="permanent"]').checked = Boolean(item.permanent);

  row.draggable = true;
  row.addEventListener("dragstart", (event) => {
    row.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", definitionId);
    }
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    syncItemsFromDefinitions();
    recalculateAndRender();
  });

  row.addEventListener("input", () => {
    syncItemsFromDefinitions();
    recalculateAndRender();
  });
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    syncItemsFromDefinitions();
    recalculateAndRender();
  });

  elements.itemDefinitionsBody.appendChild(row);
}

function writeProfileToForm(profile) {
  elements.profileName.value = profile.name || "";

  const fallbackDefinitions = [
    { name: "Pilot", arm: 420, weightFactor: 1, permanent: false },
    { name: "Baggage", arm: 620, weightFactor: 1, permanent: false },
    { name: "Ballast", arm: 280, weightFactor: 1, permanent: false }
  ];

  const aircraft = profile.aircraft || {};
  elements.emptyWeight.value = aircraft.emptyWeight ?? 0;
  elements.emptyArm.value = aircraft.emptyArm ?? 0;
  elements.wingArea.value = aircraft.wingArea ?? 0;
  elements.maxWeight.value = aircraft.maxWeight ?? 0;
  elements.minCg.value = aircraft.minCg ?? 0;
  elements.maxCg.value = aircraft.maxCg ?? 0;
  elements.idealMinCg.value = aircraft.idealMinCg ?? 420;
  elements.idealMaxCg.value = aircraft.idealMaxCg ?? 480;
  elements.itemDefinitionsBody.textContent = "";

  const items = Array.isArray(profile.items) ? profile.items : Array.isArray(profile.stations) ? profile.stations : [];
  const itemDefinitions = Array.isArray(aircraft.itemDefinitions)
    ? aircraft.itemDefinitions
    : Array.isArray(aircraft.stationDefinitions)
      ? aircraft.stationDefinitions
      : items.map((item) => ({
        name: item.name,
        arm: item.arm,
        weightFactor: item.weightFactor ?? 1,
        permanent: Boolean(item.permanent)
      }));
  const normalizedItemDefinitions = itemDefinitions.map((definition) => ({
    ...definition,
    id: definition.id || createId("def")
  }));
  const itemWeights = new Map(items.map((item, index) => [
    normalizedItemDefinitions[index] ? normalizedItemDefinitions[index].id : createId("def"),
    Number(item.weight) || 0
  ]));

  if (itemDefinitions.length === 0) {
    fallbackDefinitions.forEach((definition) => addItemDefinitionRow({ ...definition, id: createId("def") }));
  } else {
    normalizedItemDefinitions.forEach((definition) => addItemDefinitionRow(definition));
  }

  if (itemDefinitions.length === 0) {
    const defaults = itemDefinitionsFromForm();
    const defaultWeightMap = new Map(defaults.map((definition, index) => [definition.id, [82, 8, 4][index] ?? 0]));
    renderItemRows(defaults, defaultWeightMap);
  } else {
    renderItemRows(itemDefinitionsFromForm(), itemWeights);
  }

  recalculateAndRender();
}

function renderProfileSelect(profiles) {
  const initialOption = '<option value="">Select a saved profile</option>';
  const options = profiles
    .map((profile) => `<option value="${profile.id}">${profile.name}</option>`)
    .join("");

  elements.profileSelect.innerHTML = initialOption + options;

  if (state.selectedProfileId) {
    elements.profileSelect.value = state.selectedProfileId;
  }
}

async function refreshProfiles() {
  const profiles = await listProfiles();
  renderProfileSelect(profiles || []);
}

function drawEnvelope(aircraft, totals, balance, cgPercent) {
  const canvas = elements.envelopeCanvas;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  context.clearRect(0, 0, width, height);

  const margin = { top: 24, right: 24, bottom: 36, left: 54 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  const polygon = envelopePolygon(aircraft);
  if (!polygon) {
    context.fillStyle = "#6a5850";
    context.font = '15px "IBM Plex Mono"';
    context.fillText("Set min/max weight and CG limits to display envelope.", 24, height / 2);
    return;
  }

  const cgValues = polygon.map((point) => point.cg).concat([totals.cg]);
  const weightValues = polygon.map((point) => point.weight).concat([totals.totalWeight]);

  const minCg = Math.min(...cgValues) - 10;
  const maxCg = Math.max(...cgValues) + 10;
  const minWeight = Math.min(...weightValues) - 10;
  const maxWeight = Math.max(...weightValues) + 10;

  const xForCg = (cg) => margin.left + ((cg - minCg) / (maxCg - minCg || 1)) * graphWidth;
  const yForWeight = (weight) =>
    margin.top + graphHeight - ((weight - minWeight) / (maxWeight - minWeight || 1)) * graphHeight;

  context.strokeStyle = "rgba(95, 60, 36, 0.35)";
  context.lineWidth = 1;

  context.beginPath();
  context.moveTo(margin.left, margin.top);
  context.lineTo(margin.left, height - margin.bottom);
  context.lineTo(width - margin.right, height - margin.bottom);
  context.stroke();

  context.fillStyle = "#6a5850";
  context.font = '12px "IBM Plex Mono"';
  context.fillText("CG", width - margin.right - 20, height - 10);
  context.save();
  context.translate(12, margin.top + graphHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("Weight", 0, 0);
  context.restore();

  // Draw ideal CG range
  const idealMinCg = Number(aircraft.idealMinCg);
  const idealMaxCg = Number(aircraft.idealMaxCg);
  if (Number.isFinite(idealMinCg) && Number.isFinite(idealMaxCg) && idealMaxCg > idealMinCg) {
    const idealMinX = xForCg(idealMinCg);
    const idealMaxX = xForCg(idealMaxCg);
    context.fillStyle = "rgba(42, 127, 98, 0.15)";
    context.fillRect(idealMinX, margin.top, idealMaxX - idealMinX, graphHeight);
    
    // Draw border lines for ideal range
    context.strokeStyle = "rgba(42, 127, 98, 0.4)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(idealMinX, margin.top);
    context.lineTo(idealMinX, height - margin.bottom);
    context.moveTo(idealMaxX, margin.top);
    context.lineTo(idealMaxX, height - margin.bottom);
    context.stroke();
  }

  context.beginPath();
  polygon.forEach((point, index) => {
    const x = xForCg(point.cg);
    const y = yForWeight(point.weight);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fillStyle = "rgba(202, 83, 16, 0.15)";
  context.fill();
  context.strokeStyle = "#ca5310";
  context.lineWidth = 2;
  context.stroke();

  // Draw dotted horizontal lines for max weight and empty weight
  context.strokeStyle = "rgba(95, 60, 36, 0.4)";
  context.lineWidth = 1;
  context.setLineDash([4, 3]);
  context.font = '11px "IBM Plex Mono"';
  context.fillStyle = "#6a5850";

  // Max weight line
  const maxWeightY = yForWeight(aircraft.maxWeight);
  context.beginPath();
  context.moveTo(margin.left, maxWeightY);
  context.lineTo(width - margin.right, maxWeightY);
  context.stroke();
  context.fillText(`${aircraft.maxWeight.toFixed(0)} kg (max)`, margin.left + 4, maxWeightY - 3);

  // Empty weight line
  const emptyWeightY = yForWeight(aircraft.emptyWeight);
  context.beginPath();
  context.moveTo(margin.left, emptyWeightY);
  context.lineTo(width - margin.right, emptyWeightY);
  context.stroke();
  context.fillText(`${aircraft.emptyWeight.toFixed(0)} kg (empty)`, margin.left + 4, emptyWeightY - 3);

  context.setLineDash([]);

  const pointX = xForCg(totals.cg);
  const pointY = yForWeight(totals.totalWeight);
  context.beginPath();
  context.arc(pointX, pointY, 6, 0, Math.PI * 2);
  context.fillStyle = balance.className === "ok" ? "#2a7f62" : "#a4161a";
  context.fill();

  context.fillStyle = "#2a1f1b";
  context.font = '12px "IBM Plex Mono"';
  context.fillText(
    `${totals.totalWeight.toFixed(1)} kg @ ${totals.cg.toFixed(0)} mm`,
    Math.max(margin.left, pointX - 70),
    Math.max(margin.top + 14, pointY - 10)
  );

  context.fillText(
    `CG in limits: ${cgPercent === null ? "N/A" : `${cgPercent.toFixed(1)}%`}`,
    Math.max(margin.left, pointX - 70),
    Math.max(margin.top + 28, pointY + 6)
  );

  context.strokeStyle = "rgba(95, 60, 36, 0.35)";
  context.lineWidth = 1;
  context.setLineDash([4, 3]);

  // Vertical guide for the actual CG position.
  context.beginPath();
  context.moveTo(pointX, pointY);
  context.lineTo(pointX, height - margin.bottom);
  context.stroke();

  // Horizontal guide for the actual total weight.
  context.beginPath();
  context.moveTo(margin.left, pointY);
  context.lineTo(pointX, pointY);
  context.stroke();

  context.setLineDash([]);
  context.fillStyle = "#6a5850";
  context.font = '11px "IBM Plex Mono"';

  const cgLabel = `${totals.cg.toFixed(0)} mm`;
  const weightLabel = `${totals.totalWeight.toFixed(1)} kg`;
  const cgLabelWidth = context.measureText(cgLabel).width;
  const weightLabelWidth = context.measureText(weightLabel).width;

  context.fillText(
    cgLabel,
    Math.max(margin.left, Math.min(pointX - cgLabelWidth / 2, width - margin.right - cgLabelWidth)),
    height - 12
  );
  context.fillText(
    weightLabel,
    10,
    Math.max(margin.top + 12, pointY - 4)
  );
}

function recalculateAndRender() {
  const aircraft = aircraftFromForm();
  const totals = calculateTotals(aircraft, combinedItemsFromForm());
  const balance = evaluateBalance(aircraft, totals);
  const wingLoading = aircraft.wingArea > 0 ? totals.totalWeight / aircraft.wingArea : 0;
  const cgPercent = cgPercentWithinLimits(aircraft, totals.cg);

  elements.totalWeightValue.textContent = `${totals.totalWeight.toFixed(1)} kg`;
  elements.wingLoadingValue.textContent = `${wingLoading.toFixed(1)} kg/m²`;
  elements.cgValue.textContent = `${totals.cg.toFixed(0)} mm`;

  const statusCard = elements.balanceStatusValue.closest(".result-card.status");
  statusCard.classList.remove("ok", "warn", "bad");
  statusCard.classList.add(balance.className);
  const percentText = cgPercent === null ? "N/A" : `${cgPercent.toFixed(1)}%`;
  elements.balanceStatusValue.innerHTML = `${balance.label}<br><span style="font-weight: 400; opacity: 0.8;">${percentText}</span>`;

  drawEnvelope(aircraft, totals, balance, cgPercent);
}

async function saveNewProfile() {
  const payload = profilePayload();
  if (!payload.name) {
    setStatus("Please enter a profile name before saving.", true);
    return;
  }

  const saved = await createProfile(payload);
  state.selectedProfileId = saved.id;
  await refreshProfiles();
  elements.profileSelect.value = state.selectedProfileId;
  setStatus(`Saved profile '${saved.name}'.`);
}

async function updateCurrentProfile() {
  if (!state.selectedProfileId) {
    setStatus("Select and load a profile before updating.", true);
    return;
  }

  const payload = profilePayload();
  if (!payload.name) {
    setStatus("Profile name cannot be empty.", true);
    return;
  }

  const updated = await updateProfile(state.selectedProfileId, payload);
  await refreshProfiles();
  elements.profileSelect.value = state.selectedProfileId;
  setStatus(`Updated profile '${updated.name}'.`);
}

async function loadSelectedProfile() {
  const id = elements.profileSelect.value;
  if (!id) {
    setStatus("Choose a profile to load.", true);
    return;
  }

  const profile = await getProfile(id);
  state.selectedProfileId = id;
  writeProfileToForm(profile);
  setStatus(`Loaded profile '${profile.name}'.`);
}

async function removeSelectedProfile() {
  const id = elements.profileSelect.value;
  if (!id) {
    setStatus("Choose a profile to delete.", true);
    return;
  }

  await deleteProfile(id);
  if (state.selectedProfileId === id) {
    state.selectedProfileId = "";
  }

  await refreshProfiles();
  setStatus("Profile deleted.");
}

async function runAction(fn) {
  try {
    await fn();
  } catch (error) {
    setStatus(error.message || "Unexpected error", true);
  }
}

function bindEvents() {
  elements.itemDefinitionsBody.addEventListener("dragover", handleItemDefinitionDragOver);

  elements.addItemDefinitionBtn.addEventListener("click", () => {
    addItemDefinitionRow({ name: "Item", arm: 0, weightFactor: 1, permanent: false });
    syncItemsFromDefinitions();
    recalculateAndRender();
  });

  [
    elements.emptyWeight,
    elements.emptyArm,
    elements.wingArea,
    elements.maxWeight,
    elements.minCg,
    elements.maxCg,
    elements.idealMinCg,
    elements.idealMaxCg,
    elements.profileName
  ].forEach((input) => {
    input.addEventListener("input", recalculateAndRender);
  });

  elements.saveProfileBtn.addEventListener("click", () => runAction(saveNewProfile));
  elements.updateProfileBtn.addEventListener("click", () => runAction(updateCurrentProfile));
  elements.loadProfileBtn.addEventListener("click", () => runAction(loadSelectedProfile));
  elements.deleteProfileBtn.addEventListener("click", () => runAction(removeSelectedProfile));
  elements.profileSelect.addEventListener("change", () => {
    state.selectedProfileId = elements.profileSelect.value;
  });
}

async function init() {
  bindEvents();

  const defaultDefinitions = [
    { name: "Pilot", arm: 420, weightFactor: 1, permanent: false },
    { name: "Baggage", arm: 620, weightFactor: 1, permanent: false },
    { name: "Ballast", arm: 280, weightFactor: 1, permanent: false }
  ];
  const defaultDefinitionsWithIds = defaultDefinitions.map((definition) => ({
    ...definition,
    id: createId("def")
  }));
  defaultDefinitionsWithIds.forEach((definition) => addItemDefinitionRow(definition));
  renderItemRows(defaultDefinitionsWithIds, new Map([
    [defaultDefinitionsWithIds[0].id, 82],
    [defaultDefinitionsWithIds[1].id, 8],
    [defaultDefinitionsWithIds[2].id, 4]
  ]));

  recalculateAndRender();

  try {
    await refreshProfiles();
  } catch (error) {
    setStatus(`Unable to load profiles: ${error.message}`, true);
  }
}

init();
