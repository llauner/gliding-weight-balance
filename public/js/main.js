import {
  calculateTotals,
  envelopePolygon,
  evaluateBalance
} from "./calculations.js";
import {
  createProfile,
  deleteProfile,
  downloadProfileQrCode,
  getProfile,
  listProfiles,
  setAuthTokenGetter,
  updateProfile
} from "./api.js";
import {
  getCurrentIdToken,
  getCurrentUser,
  initIdentityAuth,
  isAuthEnabled,
  onIdentityAuthChanged,
  signInWithGooglePopup,
  signOutIdentity
} from "./auth.js";
import {
  applyStaticTranslations,
  changeLanguage,
  currentLanguage,
  initI18n,
  localizeApiErrorMessage,
  t
} from "./i18n.js";
import { forceUpdateServiceWorker, registerServiceWorker } from "./sw-update.js";
import { getPublicProfile } from "./api.js";

const elements = {
  profileName: document.querySelector("#profileName"),
  profileSettingsBtn: document.querySelector("#profileSettingsBtn"),
  profileIsPublic: document.querySelector("#profileIsPublic"),
  profileIsDefault: document.querySelector("#profileIsDefault"),
  profileSelect: document.querySelector("#profileSelect"),
  saveProfileBtn: document.querySelector("#saveProfileBtn"),
  updateProfileBtn: document.querySelector("#updateProfileBtn"),
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
  languageDropdownBtn: document.querySelector("#languageDropdownBtn"),
  languageDropdownMenu: document.querySelector("#languageDropdownMenu"),
  languageDropdownCurrentFlag: document.querySelector("#languageDropdownCurrentFlag"),
  languageDropdownCurrentLabel: document.querySelector("#languageDropdownCurrentLabel"),
  localeOptions: Array.from(document.querySelectorAll(".locale-option")),
  menuBtn: document.querySelector("#menuBtn"),
  menuDropdown: document.querySelector("#menuDropdown"),
  menuCreateQrBtn: document.querySelector("#menuCreateQrBtn"),
  menuAboutBtn: document.querySelector("#menuAboutBtn"),
  menuForceUpdateBtn: document.querySelector("#menuForceUpdateBtn"),
  aboutModal: document.querySelector("#aboutModal"),
  aboutVersionValue: document.querySelector("#aboutVersionValue"),
  aboutModalOkBtn: document.querySelector("#aboutModalOkBtn"),
  profileSettingsModal: document.querySelector("#profileSettingsModal"),
  profileSettingsOkBtn: document.querySelector("#profileSettingsOkBtn"),
  authUserText: document.querySelector("#authUserText"),
  signInBtn: document.querySelector("#signInBtn"),
  itemsBody: document.querySelector("#itemsBody"),
  permanentItemsBody: document.querySelector("#permanentItemsBody"),
  itemRowTemplate: document.querySelector("#itemRowTemplate"),
  itemDefinitionsBody: document.querySelector("#itemDefinitionsBody"),
  itemDefinitionRowTemplate: document.querySelector("#itemDefinitionRowTemplate"),
  addItemDefinitionBtn: document.querySelector("#addItemDefinitionBtn"),
  envelopeCanvas: document.querySelector("#envelopeCanvas"),
  aircraftSetupToggle: document.querySelector("#aircraftSetupToggle"),
  aircraftSetupPanel: document.querySelector(".aircraft-setup")
};

const state = {
  selectedProfileId: "",
  profiles: [],
  authenticatedUser: null,
  authEnabled: false,
  viewingSharedProfile: false,
  loadedProfileUserId: null,
  loadedProfileName: "",
  loadedProfileIsDefault: false
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
  if (elements.statusText) {
    elements.statusText.textContent = message;
    elements.statusText.style.color = isError ? "#a4161a" : "#6a5850";
  }
  // Optionally show a toast or alert for force update
  if (isError && window && window.alert) {
    window.alert(message);
  }
}

function setMenuOpen(isOpen) {
  if (!elements.menuBtn || !elements.menuDropdown) {
    return;
  }

  elements.menuDropdown.hidden = !isOpen;
  elements.menuBtn.setAttribute("aria-expanded", String(isOpen));
}

function updateCreateQrMenuAvailability() {
  if (!elements.menuCreateQrBtn) {
    return;
  }

  const hasSelectedProfile = Boolean(elements.profileSelect && elements.profileSelect.value);
  const isPublicProfile = Boolean(elements.profileIsPublic && elements.profileIsPublic.checked);
  const canCreateQr = hasSelectedProfile && isPublicProfile;

  elements.menuCreateQrBtn.disabled = !canCreateQr;
  elements.menuCreateQrBtn.setAttribute("aria-disabled", String(!canCreateQr));

  if (!hasSelectedProfile) {
    elements.menuCreateQrBtn.title = t("status.chooseProfileToLoad");
  } else if (!isPublicProfile) {
    elements.menuCreateQrBtn.title = t("status.profileMustBePublicForQr");
  } else {
    elements.menuCreateQrBtn.title = t("menu.createQrCode");
  }
}

function setLanguageDropdownOpen(isOpen) {
  if (!elements.languageDropdownBtn || !elements.languageDropdownMenu) {
    return;
  }

  elements.languageDropdownMenu.hidden = !isOpen;
  elements.languageDropdownBtn.setAttribute("aria-expanded", String(isOpen));
}

function handleCreateQrCode() {
  const selectedId = elements.profileSelect ? elements.profileSelect.value : "";
  if (!selectedId) {
    setStatus(t("status.chooseProfileToLoad"), true);
    return;
  }

  if (!(elements.profileIsPublic && elements.profileIsPublic.checked)) {
    setStatus(t("status.profileMustBePublicForQr"), true);
    return;
  }

  runAction(async () => {
    const { blob, fileName } = await downloadProfileQrCode(selectedId);
    const objectUrl = URL.createObjectURL(blob);

    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus(t("status.qrCodeDownloaded", { fileName }));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  });
}

function setAboutVersionText(value) {
  if (!elements.aboutVersionValue) {
    return;
  }

  elements.aboutVersionValue.textContent = value;
}

async function fetchAppVersion() {
  const response = await fetch("/api/version", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load app version (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.appVersion !== "string" || !payload.appVersion.trim()) {
    throw new Error("Invalid app version response");
  }

  return payload.appVersion.trim();
}

function setAboutModalOpen(isOpen) {
  if (!elements.aboutModal) {
    return;
  }

  elements.aboutModal.hidden = !isOpen;
}

function setProfileSettingsModalOpen(isOpen) {
  if (!elements.profileSettingsModal) {
    return;
  }

  elements.profileSettingsModal.hidden = !isOpen;
}

async function handleAbout() {
  setAboutVersionText("Loading...");
  setAboutModalOpen(true);

  try {
    const appVersion = await fetchAppVersion();
    setAboutVersionText(appVersion);
  } catch (_error) {
    setAboutVersionText("Unavailable");
  }
}

function isViewingOthersProfile() {
  if (!state.viewingSharedProfile) {
    return false;
  }
  // Allow editing if the authenticated user is the owner of the loaded profile
  if (state.authenticatedUser && state.loadedProfileUserId &&
      state.loadedProfileUserId === state.authenticatedUser.email) {
    return false;
  }
  return true;
}

function syncProfileControlAvailability() {
  const canManageProfiles = state.authEnabled && Boolean(state.authenticatedUser) && !isViewingOthersProfile();
  const hasProfiles = state.profiles.length > 0;

  elements.saveProfileBtn.disabled = !canManageProfiles;
  if (elements.profileSettingsBtn) {
    elements.profileSettingsBtn.disabled = !canManageProfiles;
  }
  if (elements.profileIsPublic) {
    elements.profileIsPublic.disabled = !canManageProfiles;
  }
  if (elements.updateProfileBtn) {
    elements.updateProfileBtn.disabled = !canManageProfiles;
  }
  elements.deleteProfileBtn.disabled = !canManageProfiles;
  elements.profileSelect.disabled = !hasProfiles;
  updateCreateQrMenuAvailability();
}

function updateAuthUi(user) {
  state.authenticatedUser = user || null;

  const identityLabel = state.authenticatedUser
    ? (state.authenticatedUser.displayName || state.authenticatedUser.email || "")
    : "";

  if (elements.authUserText) {
    elements.authUserText.textContent = identityLabel;
    elements.authUserText.title = identityLabel;
  }

  if (!elements.signInBtn) {
    return;
  }

  if (!state.authEnabled) {
    elements.signInBtn.textContent = "🚫";
    elements.signInBtn.disabled = true;
    elements.signInBtn.title = t("auth.notConfigured");
    elements.signInBtn.setAttribute("aria-label", t("auth.notConfigured"));
  } else if (state.authenticatedUser) {
    elements.signInBtn.textContent = "↩";
    elements.signInBtn.disabled = false;
    elements.signInBtn.title = t("auth.signOut");
    elements.signInBtn.setAttribute("aria-label", t("auth.signOut"));
  } else {
    elements.signInBtn.textContent = "🔐";
    elements.signInBtn.disabled = false;
    elements.signInBtn.title = t("auth.signInWithGoogle");
    elements.signInBtn.setAttribute("aria-label", t("auth.signInWithGoogle"));
  }

  if (!(state.authEnabled && Boolean(state.authenticatedUser))) {
    state.selectedProfileId = "";
    elements.profileSelect.value = "";
  }

  syncProfileControlAvailability();
}

function updateLocaleButtons() {
  const locale = currentLanguage();

  if (elements.localeOptions && elements.localeOptions.length > 0) {
    const activeOption = elements.localeOptions.find((option) => option.dataset.locale === locale);

    elements.localeOptions.forEach((option) => {
      const isActive = option.dataset.locale === locale;
      option.classList.toggle("active", isActive);
      option.setAttribute("aria-checked", String(isActive));
    });

    if (activeOption) {
      const activeFlag = activeOption.querySelector(".locale-option-flag");
      if (elements.languageDropdownCurrentFlag && activeFlag) {
        elements.languageDropdownCurrentFlag.innerHTML = activeFlag.innerHTML;
      }
    }
  }

  if (elements.languageDropdownCurrentLabel) {
    const labelKey = locale === "fr" ? "language.french" : "language.english";
    elements.languageDropdownCurrentLabel.textContent = t(labelKey);
  }
}

async function switchLocale(locale) {
  await changeLanguage(locale);
  applyStaticTranslations();
  updateLocaleButtons();
  updateAuthUi(state.authenticatedUser);
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

function setAircraftSetupEditable(isEditable) {
  if (!elements.aircraftSetupPanel) {
    return;
  }

  const shouldDisable = !isEditable;
  const controls = elements.aircraftSetupPanel.querySelectorAll("input, select, textarea, button");
  controls.forEach((control) => {
    if (control === elements.aircraftSetupToggle) {
      return;
    }
    control.disabled = shouldDisable;
  });

  elements.aircraftSetupPanel.classList.toggle("locked", shouldDisable);
  elements.aircraftSetupPanel.setAttribute("aria-disabled", String(shouldDisable));

  elements.itemDefinitionsBody.querySelectorAll("tr").forEach((row) => {
    row.draggable = isEditable;
  });
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

  setAircraftSetupEditable(elements.aircraftSetupToggle ? elements.aircraftSetupToggle.checked : true);
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
    isPublic: Boolean(elements.profileIsPublic && elements.profileIsPublic.checked),
    isDefault: Boolean(elements.profileIsDefault && elements.profileIsDefault.checked),
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
  setAircraftSetupEditable(elements.aircraftSetupToggle ? elements.aircraftSetupToggle.checked : true);
}

function writeProfileToForm(profile) {
  elements.profileName.value = profile.name || "";
  if (elements.profileIsPublic) {
    elements.profileIsPublic.checked = Boolean(profile.isPublic);
  }
  if (elements.profileIsDefault) {
    elements.profileIsDefault.checked = Boolean(profile.isDefault);
  }

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
  updateCreateQrMenuAvailability();
}

function renderProfileSelect(profiles) {
  if (!elements.profileSelect) {
    return;
  }

  state.profiles = Array.isArray(profiles) ? profiles : [];

  const selectableProfiles = [...state.profiles];
  if (state.selectedProfileId && !selectableProfiles.some((profile) => profile.id === state.selectedProfileId)) {
    selectableProfiles.push({
      id: state.selectedProfileId,
      name: state.loadedProfileName || state.selectedProfileId,
      isDefault: Boolean(state.loadedProfileIsDefault)
    });
  }

  const initialOption = `<option value="">${t("profiles.selectSavedProfile")}</option>`;
  const options = selectableProfiles
    .map((profile) => {
      const suffix = profile.isDefault ? ` ${t("profiles.defaultSuffix")}` : "";
      return `<option value="${profile.id}">${profile.name}${suffix}</option>`;
    })
    .join("");

  elements.profileSelect.innerHTML = initialOption + options;

  if (state.selectedProfileId) {
    elements.profileSelect.value = state.selectedProfileId;
  }

  syncProfileControlAvailability();
  updateProfileDeleteAvailability();
  updateCreateQrMenuAvailability();
}

function selectedProfileSummary() {
  return state.profiles.find((profile) => profile.id === elements.profileSelect.value) || null;
}

function sharedProfileIdFromQuery() {
  return new URLSearchParams(window.location.search).get("profileId") || "";
}

function updateProfileDeleteAvailability() {
  if (!state.authEnabled || !state.authenticatedUser) {
    elements.deleteProfileBtn.disabled = true;
    elements.deleteProfileBtn.title = t("auth.signInRequired");
    return;
  }

  const selected = selectedProfileSummary();
  const isLocked = Boolean(selected && selected.isDefault);
  elements.deleteProfileBtn.disabled = isLocked;
  elements.deleteProfileBtn.title = isLocked
    ? t("profiles.defaultProfileLocked")
    : t("profiles.deleteSelectedProfile");
}

async function refreshProfiles() {
  try {
    const profiles = await listProfiles();
    renderProfileSelect(Array.isArray(profiles) ? profiles : []);

    const shouldAutoLoadDefault = Boolean(
      state.authEnabled &&
      state.authenticatedUser &&
      !sharedProfileIdFromQuery()
    );

    if (!shouldAutoLoadDefault) {
      return;
    }

    const defaultProfile = state.profiles.find((profile) => profile.isDefault);
    if (!defaultProfile) {
      return;
    }

    if (state.selectedProfileId === defaultProfile.id && !state.viewingSharedProfile) {
      return;
    }

    state.selectedProfileId = defaultProfile.id;
    elements.profileSelect.value = defaultProfile.id;
    await loadSelectedProfile();
  } catch (error) {
    renderProfileSelect([]);
  }
}

async function handleSignInButtonClick() {
  if (!state.authEnabled) {
    setStatus(t("auth.notConfigured"), true);
    return;
  }

  if (state.authenticatedUser) {
    await signOutIdentity();
    setStatus(t("auth.signedOut"));
    await refreshProfiles();
    return;
  }

  await signInWithGooglePopup();
  setStatus(t("auth.signedIn"));
  await refreshProfiles();
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

async function saveProfile() {
  const payload = profilePayload();
  if (!payload.name) {
    setStatus(t("status.enterProfileNameBeforeSaving"), true);
    return;
  }

  if (state.selectedProfileId) {
    const updated = await updateProfile(state.selectedProfileId, payload);
    state.selectedProfileId = updated.id;
    await refreshProfiles();
    elements.profileSelect.value = state.selectedProfileId;
    setStatus(t("status.updatedProfile", { name: updated.name }));
    return;
  }

  const saved = await createProfile(payload);
  state.selectedProfileId = saved.id;
  await refreshProfiles();
  elements.profileSelect.value = state.selectedProfileId;
  setStatus(t("status.savedProfile", { name: saved.name }));
}

async function loadSelectedProfile() {
  const id = elements.profileSelect.value;
  if (!id) {
    setStatus(t("status.chooseProfileToLoad"), true);
    return;
  }

  const profile = await getProfile(id);
  state.selectedProfileId = id;
  state.viewingSharedProfile = false;
  state.loadedProfileUserId = null;
  state.loadedProfileName = profile.name || "";
  state.loadedProfileIsDefault = Boolean(profile.isDefault);
  writeProfileToForm(profile);
  updateProfileDeleteAvailability();
  syncProfileControlAvailability();
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
    state.loadedProfileName = "";
    state.loadedProfileIsDefault = false;
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
  if (elements.itemDefinitionsBody) {
    elements.itemDefinitionsBody.addEventListener("dragover", handleItemDefinitionDragOver);
  }

  if (elements.addItemDefinitionBtn) {
    elements.addItemDefinitionBtn.addEventListener("click", () => {
      addItemDefinitionRow({ name: t("defaults.item"), arm: 0, weightFactor: 1, permanent: false, waterBallast: false });
      syncItemsFromDefinitions();
      recalculateAndRender();
    });
  }

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
    if (input) {
      input.addEventListener("input", recalculateAndRender);
    }
  });

  if (elements.saveProfileBtn) {
    elements.saveProfileBtn.addEventListener("click", () => runAction(saveProfile));
  }

  if (elements.deleteProfileBtn) {
    elements.deleteProfileBtn.addEventListener("click", () => runAction(removeSelectedProfile));
  }

  if (elements.languageDropdownBtn && elements.languageDropdownMenu) {
    elements.languageDropdownBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setLanguageDropdownOpen(elements.languageDropdownMenu.hidden);
    });

    elements.localeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const selectedLanguage = option.dataset.locale;
        setLanguageDropdownOpen(false);
        if (selectedLanguage && selectedLanguage !== currentLanguage()) {
          runAction(() => switchLocale(selectedLanguage));
        }
      });
    });

    document.addEventListener("click", (event) => {
      const clickInside = event.target.closest(".locale-switcher");
      if (!clickInside) {
        setLanguageDropdownOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setLanguageDropdownOpen(false);
      }
    });
  }

  if (elements.menuBtn && elements.menuDropdown) {
    elements.menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenuOpen(elements.menuDropdown.hidden);
    });

    if (elements.menuCreateQrBtn) {
      elements.menuCreateQrBtn.addEventListener("click", () => {
        setMenuOpen(false);
        handleCreateQrCode();
      });
    }

    if (elements.menuAboutBtn) {
      elements.menuAboutBtn.addEventListener("click", () => {
        setMenuOpen(false);
        runAction(handleAbout);
      });
    }

    if (elements.menuForceUpdateBtn) {
      elements.menuForceUpdateBtn.addEventListener("click", () => {
        setMenuOpen(false);
        runAction(async () => {
          await forceUpdateServiceWorker();
          setStatus(t("menu.forceUpdate"));
        });
      });
    }

    document.addEventListener("click", (event) => {
      const clickInsideMenu = event.target.closest(".menu");
      if (!clickInsideMenu) {
        setMenuOpen(false);
      }
    });
  }

  if (elements.aboutModalOkBtn) {
    elements.aboutModalOkBtn.addEventListener("click", () => {
      setAboutModalOpen(false);
    });
  }

  if (elements.profileSettingsBtn) {
    elements.profileSettingsBtn.addEventListener("click", () => {
      setProfileSettingsModalOpen(true);
    });
  }

  if (elements.profileSettingsOkBtn) {
    elements.profileSettingsOkBtn.addEventListener("click", () => {
      setProfileSettingsModalOpen(false);
    });
  }

  if (elements.signInBtn) {
    elements.signInBtn.addEventListener("click", () => runAction(handleSignInButtonClick));
  }

  if (elements.profileSelect) {
    elements.profileSelect.addEventListener("change", () => {
      const selectedId = elements.profileSelect.value;
      if (!selectedId) {
        state.selectedProfileId = "";
        updateProfileDeleteAvailability();
        updateCreateQrMenuAvailability();
        return;
      }

      runAction(loadSelectedProfile);
    });
  }

  if (elements.profileIsPublic) {
    elements.profileIsPublic.addEventListener("change", () => {
      updateCreateQrMenuAvailability();
    });
  }
}

async function init() {
  registerServiceWorker();
  await initI18n();
  applyStaticTranslations();
  updateLocaleButtons();

  setAuthTokenGetter(() => getCurrentIdToken());
  const authInitResult = await initIdentityAuth();
  state.authEnabled = Boolean(authInitResult && authInitResult.enabled && isAuthEnabled());
  updateAuthUi(getCurrentUser());
  onIdentityAuthChanged((user) => {
    updateAuthUi(user);
    runAction(refreshProfiles);
  });

  bindEvents();

  if (elements.aircraftSetupToggle) {
    setAircraftSetupEditable(elements.aircraftSetupToggle.checked);
  }

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

  const urlParams = new URLSearchParams(window.location.search);
  const sharedProfileId = urlParams.get("profileId");
  if (sharedProfileId) {
    try {
      const profile = await getPublicProfile(sharedProfileId);
      state.selectedProfileId = profile.id || sharedProfileId;
      state.viewingSharedProfile = true;
      state.loadedProfileUserId = profile.userId || null;
      state.loadedProfileName = profile.name || "";
      state.loadedProfileIsDefault = Boolean(profile.isDefault);
      renderProfileSelect(state.profiles);
      writeProfileToForm(profile);
      syncProfileControlAvailability();
      setStatus(t("status.loadedPublicProfile", { name: profile.name }));
    } catch (_err) {
      setStatus(t("status.publicProfileNotFound"), true);
    }
  }
}

init();
