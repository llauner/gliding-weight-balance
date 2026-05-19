const resources = {
  en: {
    translation: {
      app: {
        title: "Gliding W & B"
      },
      hero: {
        logoAlt: "Glider Logo",
        title: "Glider W & B",
        subtitle: "Calculate weight, CG while saving reusable loading profiles."
      },
      language: {
        selectorLabel: "Language selector",
        english: "English",
        french: "French"
      },
      menu: {
        createQrCode: "Create QR Code",
        about: "About",
        forceUpdate: "Force Update",
        createQrCodeComingSoon: "Create QR Code coming soon.",
        aboutComingSoon: "About coming soon."
      },
      auth: {
        signInWithGoogle: "Sign in with Google",
        signOut: "Sign out",
        signInRequired: "Sign in required",
        signedIn: "Signed in.",
        signedOut: "Signed out.",
        notConfigured: "Authentication is not configured"
      },
      profiles: {
        title: "Profiles",
        profileNamePlaceholder: "Profile name",
        settings: "Profile Settings",
        publicProfile: "Public profile",
        defaultProfile: "Default profile",
        selectSavedProfile: "Select a saved profile",
        saveNewProfile: "Save new profile",
        updateSelectedProfile: "Update selected profile",
        loadSelectedProfile: "Load selected profile",
        deleteSelectedProfile: "Delete selected profile",
        defaultProfileLocked: "Default profile cannot be deleted",
        ready: "Ready.",
        defaultSuffix: "(default)"
      },
      results: {
        title: "Results",
        totalWeight: "Total Weight",
        wingLoading: "Wing Loading",
        calculatedCg: "Calculated CG",
        balanceStatus: "Balance Status",
        maxPermissibleWaterBallast: "Max Permissible Water Ballast",
        unknown: "UNKNOWN"
      },
      items: {
        title: "W&B Items",
        permanentItems: "Permanent Items",
        item: "Item",
        weightKg: "Weight (kg)"
      },
      setup: {
        title: "Aircraft Setup",
        emptyWeight: "Empty Weight (kg)",
        emptyArm: "Empty Arm (mm)",
        wingArea: "Wing Area (m²)",
        maxWeight: "Max Weight (kg)",
        minCg: "Min CG (mm)",
        maxCg: "Max CG (mm)",
        idealMinCg: "Ideal Min CG (mm)",
        idealMaxCg: "Ideal Max CG (mm)",
        definitionTitle: "Weight & Balance Items Definition",
        addItem: "Add Item",
        armMm: "Arm (mm)",
        weightFactor: "Weight Factor",
        permanent: "Permanent",
        waterBallast: "Water Ballast",
        frontSeat: "Front Seat",
        action: "Action"
      },
      template: {
        pilotPlaceholder: "Pilot",
        removeItem: "Remove item"
      },
      defaults: {
        item: "Item",
        pilot: "Pilot",
        baggage: "Baggage",
        ballast: "Ballast"
      },
      status: {
        enterProfileNameBeforeSaving: "Please enter a profile name before saving.",
        savedProfile: "Saved profile '{{name}}'.",
        selectAndLoadBeforeUpdating: "Select and load a profile before updating.",
        profileNameEmpty: "Profile name cannot be empty.",
        updatedProfile: "Updated profile '{{name}}'.",
        chooseProfileToLoad: "Choose a profile to load.",
        profileMustBePublicForQr: "Profile must be public to create a QR code.",
        qrCodeDownloaded: "QR code downloaded ({{fileName}}).",
        loadedProfile: "Loaded profile '{{name}}'.",
        chooseProfileToDelete: "Choose a profile to delete.",
        defaultCannotDelete: "Default profile cannot be deleted.",
        profileDeleted: "Profile deleted.",
        unableToLoadProfiles: "Unable to load profiles: {{message}}",
        loadedPublicProfile: "Loaded shared profile '{{name}}'.",
        publicProfileNotFound: "Shared profile not found or not public."
      },
      error: {
        unexpected: "Unexpected error",
        requestFailed: "Request failed",
        unauthorized: "Unauthorized",
        profileNotFound: "Profile not found",
        profileNameRequired: "Profile name is required",
        defaultProfileCannotDelete: "Default profile cannot be deleted"
      },
      balance: {
        inLimits: "IN LIMITS",
        weightAndCgOut: "WEIGHT + CG OUT",
        weightOut: "WEIGHT OUT",
        cgOut: "CG OUT",
        details: "Dry: {{dry}}<br>Wet: {{wet}}"
      },
      chart: {
        ariaLabel: "CG envelope chart",
        setLimits: "Set min/max weight and CG limits to display envelope.",
        axisCg: "CG",
        axisWeight: "Weight",
        maxWeightLine: "{{value}} kg (max)",
        emptyWeightLine: "{{value}} kg (empty)",
        minCgLine: "Min CG {{value}} mm",
        maxCgLine: "Max CG {{value}} mm",
        dryPoint: "Dry: {{weight}} kg @ {{cg}} mm ({{percent}})",
        wetPoint: "Wet: {{weight}} kg @ {{cg}} mm ({{percent}})",
        notAvailable: "N/A"
      }
    }
  },
  fr: {
    translation: {
      app: {
        title: "CG Planeur"
      },
      hero: {
        logoAlt: "Logo du planeur",
        title: "Centrage Planeur",
        subtitle: "Calculez la masse totale, le moment et le CG tout en enregistrant des profils de chargement reutilisables."
      },
      language: {
        selectorLabel: "Selecteur de langue",
        english: "Anglais",
        french: "Francais"
      },
      menu: {
        createQrCode: "Creer le code QR",
        about: "A Propos",
        forceUpdate: "Forcer la mise à jour",
        createQrCodeComingSoon: "Creation du code QR bientot disponible.",
        aboutComingSoon: "A Propos bientot disponible."
      },
      auth: {
        signInWithGoogle: "Se connecter avec Google",
        signOut: "Se deconnecter",
        signInRequired: "Connexion requise",
        signedIn: "Connecte.",
        signedOut: "Deconnecte.",
        notConfigured: "L'authentification n'est pas configuree"
      },
      profiles: {
        title: "Profils",
        profileNamePlaceholder: "Nom du profil",
        settings: "Parametres du profil",
        publicProfile: "Profil public",
        defaultProfile: "Profil par défaut",
        selectSavedProfile: "Selection profil enregistre",
        saveNewProfile: "Enregistrer un nouveau profil",
        updateSelectedProfile: "Mettre a jour le profil selectionne",
        loadSelectedProfile: "Charger le profil selectionne",
        deleteSelectedProfile: "Supprimer le profil selectionne",
        defaultProfileLocked: "Le profil par defaut ne peut pas etre supprime",
        ready: "Pret.",
        defaultSuffix: "(par defaut)"
      },
      results: {
        title: "Resultats",
        totalWeight: "Masse totale",
        wingLoading: "Charge alaire",
        calculatedCg: "CG calcule",
        balanceStatus: "Centrage",
        maxPermissibleWaterBallast: "Ballast maximal autorise",
        unknown: "INCONNU"
      },
      items: {
        title: "Elements M&C",
        permanentItems: "Elements permanents",
        item: "Element",
        weightKg: "Masse (kg)"
      },
      setup: {
        title: "Configuration Planeur",
        emptyWeight: "Masse a vide (kg)",
        emptyArm: "Bras a vide (mm)",
        wingArea: "Surface alaire (m²)",
        maxWeight: "Masse max (kg)",
        minCg: "CG min (mm)",
        maxCg: "CG max (mm)",
        idealMinCg: "CG ideal min (mm)",
        idealMaxCg: "CG ideal max (mm)",
        definitionTitle: "Definition des elements Masse & Centrage",
        addItem: "Ajouter un element",
        armMm: "Bras (mm)",
        weightFactor: "Facteur de masse",
        permanent: "Permanent",
        waterBallast: "Ballast",
        frontSeat: "Siege avant",
        action: "Action"
      },
      template: {
        pilotPlaceholder: "Pilote",
        removeItem: "Supprimer l'element"
      },
      defaults: {
        item: "Element",
        pilot: "Pilote",
        baggage: "Bagages",
        ballast: "Ballast"
      },
      status: {
        enterProfileNameBeforeSaving: "Veuillez saisir un nom de profil avant d'enregistrer.",
        savedProfile: "Profil '{{name}}' enregistré.",
        selectAndLoadBeforeUpdating: "Sélectionnez et chargez un profil avant la mise a jour.",
        profileNameEmpty: "Le nom du profil ne peut pas etre vide.",
        updatedProfile: "Profil '{{name}}' mis a jour.",
        chooseProfileToLoad: "Choisissez un profil a charger.",
        profileMustBePublicForQr: "Le profil doit etre public pour creer un code QR.",
        qrCodeDownloaded: "Code QR telecharge ({{fileName}}).",
        loadedProfile: "Profil '{{name}}' charge.",
        chooseProfileToDelete: "Choisissez un profil a supprimer.",
        defaultCannotDelete: "Le profil par déaut ne peut pas etre supprime.",
        profileDeleted: "Profil supprime.",
        unableToLoadProfiles: "Impossible de charger les profils : {{message}}",
        loadedPublicProfile: "Profil partage '{{name}}' charge.",
        publicProfileNotFound: "Profil partage introuvable ou non public."
      },
      error: {
        unexpected: "Erreur inattendue",
        requestFailed: "Echec de la requete",
        unauthorized: "Non autorise",
        profileNotFound: "Profil introuvable",
        profileNameRequired: "Le nom du profil est requis",
        defaultProfileCannotDelete: "Le profil par défaut ne peut pas etre supprimé"
      },
      balance: {
        inLimits: "LIMITES: OK",
        weightAndCgOut: "MASSE + CG HORS LIMITES",
        weightOut: "MASSE HORS LIMITES",
        cgOut: "CG HORS LIMITES",
        details: "A vide : {{dry}}<br>Ballasté : {{wet}}"
      },
      chart: {
        ariaLabel: "Graphique de l'enveloppe de CG",
        setLimits: "Définissez les limites min/max de masse et de CG pour afficher l'enveloppe.",
        axisCg: "CG",
        axisWeight: "Masse",
        maxWeightLine: "{{value}} kg (max)",
        emptyWeightLine: "{{value}} kg (vide)",
        minCgLine: "CG min {{value}} mm",
        maxCgLine: "CG max {{value}} mm",
        dryPoint: "A vide : {{weight}} kg @ {{cg}} mm ({{percent}})",
        wetPoint: "Ballasté : {{weight}} kg @ {{cg}} mm ({{percent}})",
        notAvailable: "N/A"
      }
    }
  }
};

export async function initI18n() {
  await window.i18next.init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

  document.documentElement.lang = window.i18next.language;
}

export function t(key, options = {}) {
  return window.i18next.t(key, options);
}

export async function changeLanguage(locale) {
  await window.i18next.changeLanguage(locale);
  document.documentElement.lang = window.i18next.language;
}

export function currentLanguage() {
  return window.i18next.language;
}

export function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) {
      return;
    }

    node.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    const mapping = node.dataset.i18nAttr;
    if (!mapping) {
      return;
    }

    mapping.split(";").forEach((entry) => {
      const [attr, key] = entry.split(":").map((part) => part && part.trim());
      if (!attr || !key) {
        return;
      }

      node.setAttribute(attr, t(key));
    });
  });
}

export function localizeApiErrorMessage(message) {
  const keyByMessage = {
    "Request failed": "error.requestFailed",
    Unauthorized: "error.unauthorized",
    "Profile not found": "error.profileNotFound",
    "Profile name is required": "error.profileNameRequired",
    "Default profile cannot be deleted": "error.defaultProfileCannotDelete"
  };

  const key = keyByMessage[String(message || "")] || null;
  return key ? t(key) : String(message || t("error.unexpected"));
}
