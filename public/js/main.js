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
import {
  applyStaticTranslations,
  changeLanguage,
  currentLanguage,
  initI18n,
  localizeApiErrorMessage,
  t
} from "./i18n.js";

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
  maxWaterBallastValue: document.querySelector("#maxWaterBallastValue"),
  localeEnBtn: document.querySelector("#localeEnBtn"),
  localeFrBtn: document.querySelector("#localeFrBtn"),
  itemsBody: document.querySelector("#itemsBody"),
  permanentItemsBody: document.querySelector("#permanentItemsBody"),
  itemRowTemplate: document.querySelector("#itemRowTemplate"),
  itemDefinitionsBody: document.querySelector("#itemDefinitionsBody"),
  itemDefinitionRowTemplate: document.querySelector("#itemDefinitionRowTemplate"),
  addItemDefinitionBtn: document.querySelector("#addItemDefinitionBtn"),
  envelopeCanvas: document.querySelector("#envelopeCanvas")
};

const state = {
  selectedProfileId: "",
  profiles: []
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

function updateLocaleButtons() {
  const locale = currentLanguage();
  elements.localeEnBtn.classList.toggle("active", locale === "en");
  elements.localeFrBtn.classList.toggle("active", locale === "fr");
}

async function switchLocale(locale) {
  await changeLanguage(locale);
  applyStaticTranslations();
  updateLocaleButtons();
  renderProfileSelect(state.profiles);
  syncItemsFromDefinitions();
  recalculateAndRender();
  setStatus(t("profiles.ready"));
}

function translateBalanceLabel(label) {
  const map = {
    "IN LIMITS": "balance.inLimits",
    "WEIGHT + CG OUT": "balance.weightAndCgOut",
    "WEIGHT OUT": "balance.weightOut",
    "CG OUT": "balance.cgOut"
  };

  return t(map[label] || "results.unknown");
}

function cgPercentWithinLimits(aircraft, cg) {
  const minCg = Number(aircraft.minCg);
  const maxCg = Number(aircraft.maxCg);

  if (!Number.isFinite(minCg) || !Number.isFinite(maxCg) || maxCg <= minCg) {
    return null;
  }

  return ((cg - minCg) / (maxCg - minCg)) * 100;
}

function calculateDryAndWetTotals(aircraft, items) {
  // Calculate wet total (all items including water ballast)
  const wetTotals = calculateTotals(aircraft, items);
  
  // Calculate dry total (excluding water ballast items)
  const dryItems = items.filter(item => !item.waterBallast);
  const dryTotals = calculateTotals(aircraft, dryItems);
  
  const dryPercent = cgPercentWithinLimits(aircraft, dryTotals.cg);
  const wetPercent = cgPercentWithinLimits(aircraft, wetTotals.cg);
  
  return {
    dryTotals,
    wetTotals,
    dryPercent,
    wetPercent
  };
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
    name: row.querySelector('[data-field="name"]').value.trim() || t("defaults.item"),
    arm: numberValue(row.querySelector('[data-field="arm"]')),
    weightFactor: clampWeightFactor(numberValue(row.querySelector('[data-field="weightFactor"]'))),
    permanent: row.querySelector('[data-field="permanent"]').checked,
    waterBallast: row.querySelector('[data-field="waterBallast"]').checked
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
    permanent: definition.permanent,
    waterBallast: definition.waterBallast
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
    row.addEventListener("change", recalculateAndRender);
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

function addItemDefinitionRow(item = { name: "", arm: 0, weightFactor: 1, permanent: false, waterBallast: false }) {
  const fragment = elements.itemDefinitionRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");
  const definitionId = item.id || createId("def");

  row.dataset.definitionId = definitionId;

  row.querySelector('[data-field="name"]').value = item.name ?? "";
  row.querySelector('[data-field="arm"]').value = item.arm ?? 0;
  row.querySelector('[data-field="weightFactor"]').value = clampWeightFactor(item.weightFactor ?? 1);
  row.querySelector('[data-field="permanent"]').checked = Boolean(item.permanent);
  row.querySelector('[data-field="waterBallast"]').checked = Boolean(item.waterBallast);
  row.querySelector('[data-field="name"]').placeholder = t("template.pilotPlaceholder");
  const removeButton = row.querySelector('[data-action="remove"]');
  removeButton.title = t("template.removeItem");
  removeButton.setAttribute("aria-label", t("template.removeItem"));

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

  const onDefinitionChange = () => {
    syncItemsFromDefinitions();
    recalculateAndRender();
  };
  row.addEventListener("input", onDefinitionChange);
  row.addEventListener("change", onDefinitionChange);
  removeButton.addEventListener("click", () => {
    row.remove();
    syncItemsFromDefinitions();
    recalculateAndRender();
  });

  elements.itemDefinitionsBody.appendChild(row);
}

function writeProfileToForm(profile) {
  elements.profileName.value = profile.name || "";

  const fallbackDefinitions = [
    { name: t("defaults.pilot"), arm: 420, weightFactor: 1, permanent: false, waterBallast: false },
    { name: t("defaults.baggage"), arm: 620, weightFactor: 1, permanent: false, waterBallast: false },
    { name: t("defaults.ballast"), arm: 280, weightFactor: 1, permanent: false, waterBallast: false }
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
        permanent: Boolean(item.permanent),
        waterBallast: Boolean(item.waterBallast)
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
  state.profiles = Array.isArray(profiles) ? profiles : [];
  const initialOption = `<option value="">${t("profiles.selectSavedProfile")}</option>`;
  const options = state.profiles
    .map((profile) => {
      const suffix = profile.isDefault ? ` ${t("profiles.defaultSuffix")}` : "";
      return `<option value="${profile.id}">${profile.name}${suffix}</option>`;
    })
    .join("");

  elements.profileSelect.innerHTML = initialOption + options;

  if (state.selectedProfileId) {
    elements.profileSelect.value = state.selectedProfileId;
  }

  updateProfileDeleteAvailability();
}

function selectedProfileSummary() {
  return state.profiles.find((profile) => profile.id === elements.profileSelect.value) || null;
}

function updateProfileDeleteAvailability() {
  const selected = selectedProfileSummary();
  const isLocked = Boolean(selected && selected.isDefault);
  elements.deleteProfileBtn.disabled = isLocked;
  elements.deleteProfileBtn.title = isLocked
    ? t("profiles.defaultProfileLocked")
    : t("profiles.deleteSelectedProfile");
}

async function refreshProfiles() {
  const profiles = await listProfiles();
  renderProfileSelect(profiles || []);
}

function drawEnvelope(aircraft, dryTotals, wetTotals, balance, dryPercent, wetPercent) {
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
    context.fillStyle = "#5f6368";
    context.font = '15px "Roboto Mono", monospace';
    context.fillText(t("chart.setLimits"), 24, height / 2);
    return;
  }

  const cgValues = polygon.map((point) => point.cg).concat([dryTotals.cg, wetTotals.cg]);
  const weightValues = polygon.map((point) => point.weight).concat([dryTotals.totalWeight, wetTotals.totalWeight]);

  const minCg = Math.min(...cgValues) - 10;
  const maxCg = Math.max(...cgValues) + 10;
  const minWeight = Math.min(...weightValues) - 10;
  const maxWeight = Math.max(...weightValues) + 10;

  const xForCg = (cg) => margin.left + ((cg - minCg) / (maxCg - minCg || 1)) * graphWidth;
  const yForWeight = (weight) =>
    margin.top + graphHeight - ((weight - minWeight) / (maxWeight - minWeight || 1)) * graphHeight;

  context.strokeStyle = "#dadce0";
  context.lineWidth = 1;

  context.beginPath();
  context.moveTo(margin.left, margin.top);
  context.lineTo(margin.left, height - margin.bottom);
  context.lineTo(width - margin.right, height - margin.bottom);
  context.stroke();

  context.fillStyle = "#5f6368";
  context.font = '12px "Roboto Mono", monospace';
  context.fillText(t("chart.axisCg"), width - margin.right - 20, height - 10);
  context.save();
  context.translate(12, margin.top + graphHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(t("chart.axisWeight"), 0, 0);
  context.restore();

  // Draw ideal CG range
  const idealMinCg = Number(aircraft.idealMinCg);
  const idealMaxCg = Number(aircraft.idealMaxCg);
  if (Number.isFinite(idealMinCg) && Number.isFinite(idealMaxCg) && idealMaxCg > idealMinCg) {
    const idealMinX = xForCg(idealMinCg);
    const idealMaxX = xForCg(idealMaxCg);
    context.fillStyle = "rgba(24, 128, 56, 0.12)";
    context.fillRect(idealMinX, margin.top, idealMaxX - idealMinX, graphHeight);
    
    // Draw border lines for ideal range
    context.strokeStyle = "rgba(24, 128, 56, 0.3)";
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
  context.fillStyle = "rgba(31, 115, 230, 0.12)";
  context.fill();
  context.strokeStyle = "#1f73e6";
  context.lineWidth = 2;
  context.stroke();

  // Draw dotted horizontal lines for max weight and empty weight
  context.strokeStyle = "#dadce0";
  context.lineWidth = 1;
  context.setLineDash([4, 3]);
  context.font = '11px "Roboto Mono", monospace';
  context.fillStyle = "#5f6368";

  // Max weight line
  const maxWeightY = yForWeight(aircraft.maxWeight);
  context.beginPath();
  context.moveTo(margin.left, maxWeightY);
  context.lineTo(width - margin.right, maxWeightY);
  context.stroke();
  context.fillText(t("chart.maxWeightLine", { value: aircraft.maxWeight.toFixed(0) }), margin.left + 4, maxWeightY - 3);

  // Empty weight line
  const emptyWeightY = yForWeight(aircraft.emptyWeight);
  context.beginPath();
  context.moveTo(margin.left, emptyWeightY);
  context.lineTo(width - margin.right, emptyWeightY);
  context.stroke();
  context.fillText(t("chart.emptyWeightLine", { value: aircraft.emptyWeight.toFixed(0) }), margin.left + 4, emptyWeightY - 3);

  // Min/Max CG guide lines
  const minCgGuideX = xForCg(aircraft.minCg);
  const maxCgGuideX = xForCg(aircraft.maxCg);
  context.setLineDash([]);
  context.strokeStyle = "#f57c00";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(minCgGuideX, margin.top);
  context.lineTo(minCgGuideX, height - margin.bottom);
  context.moveTo(maxCgGuideX, margin.top);
  context.lineTo(maxCgGuideX, height - margin.bottom);
  context.stroke();

  context.fillStyle = "#f57c00";
  context.fillText(t("chart.minCgLine", { value: aircraft.minCg.toFixed(0) }), Math.max(margin.left, minCgGuideX - 36), height - margin.bottom + 14);
  context.fillText(t("chart.maxCgLine", { value: aircraft.maxCg.toFixed(0) }), Math.max(margin.left, maxCgGuideX - 36), height - margin.bottom + 28);

  context.strokeStyle = "#dadce0";
  context.lineWidth = 1;
  context.fillStyle = "#5f6368";

  context.setLineDash([]);

  // Draw dry point
  const dryPointX = xForCg(dryTotals.cg);
  const dryPointY = yForWeight(dryTotals.totalWeight);
  context.beginPath();
  context.arc(dryPointX, dryPointY, 5, 0, Math.PI * 2);
  context.fillStyle = "#1f73e6";
  context.fill();

  // Draw wet point
  const wetPointX = xForCg(wetTotals.cg);
  const wetPointY = yForWeight(wetTotals.totalWeight);
  context.beginPath();
  context.arc(wetPointX, wetPointY, 6, 0, Math.PI * 2);
  context.fillStyle = balance.className === "ok" ? "#188038" : "#d33b27";
  context.fill();

  context.fillStyle = "#202124";
  context.font = '12px "Roboto Mono", monospace';
  
  // Dry label
  const dryPercentText = dryPercent === null ? t("chart.notAvailable") : `${dryPercent.toFixed(1)}%`;
  context.fillText(
    t("chart.dryPoint", {
      weight: dryTotals.totalWeight.toFixed(1),
      cg: dryTotals.cg.toFixed(0),
      percent: dryPercentText
    }),
    Math.max(margin.left, dryPointX - 120),
    Math.max(margin.top + 14, dryPointY - 20)
  );

  // Wet label
  const wetPercentText = wetPercent === null ? t("chart.notAvailable") : `${wetPercent.toFixed(1)}%`;
  context.fillText(
    t("chart.wetPoint", {
      weight: wetTotals.totalWeight.toFixed(1),
      cg: wetTotals.cg.toFixed(0),
      percent: wetPercentText
    }),
    Math.max(margin.left, wetPointX - 120),
    Math.max(margin.top + 28, wetPointY + 6)
  );

  context.strokeStyle = "#dadce0";
  context.lineWidth = 1;
  context.setLineDash([4, 3]);

  // Vertical guide for the dry CG position
  context.beginPath();
  context.moveTo(dryPointX, dryPointY);
  context.lineTo(dryPointX, height - margin.bottom);
  context.stroke();

  // Vertical guide for the wet CG position
  context.beginPath();
  context.moveTo(wetPointX, wetPointY);
  context.lineTo(wetPointX, height - margin.bottom);
  context.stroke();

  context.setLineDash([]);
}

function recalculateAndRender() {
  const aircraft = aircraftFromForm();
  const items = combinedItemsFromForm();
  const { dryTotals, wetTotals, dryPercent, wetPercent } = calculateDryAndWetTotals(aircraft, items);
  const balance = evaluateBalance(aircraft, wetTotals);
  const wingLoading = aircraft.wingArea > 0 ? wetTotals.totalWeight / aircraft.wingArea : 0;
  const maxWeight = Number(aircraft.maxWeight) || 0;
  const maxWaterBallast = Math.max(0, maxWeight - wetTotals.totalWeight);

  elements.totalWeightValue.textContent = `${wetTotals.totalWeight.toFixed(1)} kg`;
  elements.wingLoadingValue.textContent = `${wingLoading.toFixed(1)} kg/m²`;
  elements.cgValue.textContent = `${wetTotals.cg.toFixed(0)} mm`;
  elements.maxWaterBallastValue.textContent = `${Math.floor(maxWaterBallast)} kg`;

  const statusCard = elements.balanceStatusValue.closest(".result-card.status");
  statusCard.classList.remove("ok", "warn", "bad");
  statusCard.classList.add(balance.className);
  const dryPercentText = dryPercent === null ? t("chart.notAvailable") : `${dryPercent.toFixed(1)}%`;
  const wetPercentText = wetPercent === null ? t("chart.notAvailable") : `${wetPercent.toFixed(1)}%`;
  elements.balanceStatusValue.innerHTML = `${translateBalanceLabel(balance.label)}<br><span style="font-weight: 400; opacity: 0.8;">${t("balance.details", { dry: dryPercentText, wet: wetPercentText })}</span>`;

  drawEnvelope(aircraft, dryTotals, wetTotals, balance, dryPercent, wetPercent);
}

async function saveNewProfile() {
  const payload = profilePayload();
  if (!payload.name) {
    setStatus(t("status.enterProfileNameBeforeSaving"), true);
    return;
  }

  const saved = await createProfile(payload);
  state.selectedProfileId = saved.id;
  await refreshProfiles();
  elements.profileSelect.value = state.selectedProfileId;
  setStatus(t("status.savedProfile", { name: saved.name }));
}

async function updateCurrentProfile() {
  if (!state.selectedProfileId) {
    setStatus(t("status.selectAndLoadBeforeUpdating"), true);
    return;
  }

  const payload = profilePayload();
  if (!payload.name) {
    setStatus(t("status.profileNameEmpty"), true);
    return;
  }

  const updated = await updateProfile(state.selectedProfileId, payload);
  await refreshProfiles();
  elements.profileSelect.value = state.selectedProfileId;
  setStatus(t("status.updatedProfile", { name: updated.name }));
}

async function loadSelectedProfile() {
  const id = elements.profileSelect.value;
  if (!id) {
    setStatus(t("status.chooseProfileToLoad"), true);
    return;
  }

  const profile = await getProfile(id);
  state.selectedProfileId = id;
  writeProfileToForm(profile);
  updateProfileDeleteAvailability();
  setStatus(t("status.loadedProfile", { name: profile.name }));
}

async function removeSelectedProfile() {
  const id = elements.profileSelect.value;
  if (!id) {
    setStatus(t("status.chooseProfileToDelete"), true);
    return;
  }

  const selected = selectedProfileSummary();
  if (selected && selected.isDefault) {
    setStatus(t("status.defaultCannotDelete"), true);
    return;
  }

  await deleteProfile(id);
  if (state.selectedProfileId === id) {
    state.selectedProfileId = "";
  }

  await refreshProfiles();
  updateProfileDeleteAvailability();
  setStatus(t("status.profileDeleted"));
}

async function runAction(fn) {
  try {
    await fn();
  } catch (error) {
    const fallback = t("error.unexpected");
    setStatus(localizeApiErrorMessage(error.message || fallback), true);
  }
}

function bindEvents() {
  elements.itemDefinitionsBody.addEventListener("dragover", handleItemDefinitionDragOver);

  elements.addItemDefinitionBtn.addEventListener("click", () => {
    addItemDefinitionRow({ name: t("defaults.item"), arm: 0, weightFactor: 1, permanent: false, waterBallast: false });
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
  elements.localeEnBtn.addEventListener("click", () => runAction(() => switchLocale("en")));
  elements.localeFrBtn.addEventListener("click", () => runAction(() => switchLocale("fr")));
  elements.profileSelect.addEventListener("change", () => {
    state.selectedProfileId = elements.profileSelect.value;
    updateProfileDeleteAvailability();
  });
}

async function init() {
  await initI18n();
  applyStaticTranslations();
  updateLocaleButtons();

  bindEvents();

  const defaultDefinitions = [
    { name: t("defaults.pilot"), arm: 420, weightFactor: 1, permanent: false },
    { name: t("defaults.baggage"), arm: 620, weightFactor: 1, permanent: false },
    { name: t("defaults.ballast"), arm: 280, weightFactor: 1, permanent: false }
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
    setStatus(t("status.unableToLoadProfiles", { message: localizeApiErrorMessage(error.message) }), true);
  }
}

init();
