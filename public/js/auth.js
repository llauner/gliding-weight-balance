let authInstance = null;
let currentUser = null;
let authReady = false;
let authEnabled = false;
let authSdkModule = null;

async function fetchAuthConfig() {
  const response = await fetch("/api/auth/config");
  if (!response.ok) {
    throw new Error("Auth configuration unavailable");
  }

  return response.json();
}

export async function initIdentityAuth() {
  const configPayload = await fetchAuthConfig();
  if (!configPayload || !configPayload.enabled || !configPayload.config) {
    authReady = false;
    authEnabled = false;
    return { enabled: false };
  }

  const firebaseConfig = configPayload.config;

  const [{ initializeApp }, authSdk] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
  ]);

  authSdkModule = authSdk;
  const app = initializeApp(firebaseConfig, "gliding-weight-balance");
  authInstance = authSdkModule.getAuth(app);
  authReady = true;
  authEnabled = true;

  authSdkModule.onAuthStateChanged(authInstance, (user) => {
    currentUser = user || null;
  });

  return { enabled: true };
}

export function onIdentityAuthChanged(handler) {
  if (!authReady || !authInstance || !authSdkModule) {
    return () => {};
  }

  return authSdkModule.onAuthStateChanged(authInstance, (user) => {
    currentUser = user || null;
    handler(currentUser);
  });
}

export async function signInWithGooglePopup() {
  if (!authEnabled || !authInstance) {
    throw new Error("Authentication is not configured");
  }

  const provider = new authSdkModule.GoogleAuthProvider();
  const result = await authSdkModule.signInWithPopup(authInstance, provider);
  currentUser = result.user || null;
  return currentUser;
}

export async function signOutIdentity() {
  if (!authEnabled || !authInstance) {
    return;
  }

  await authSdkModule.signOut(authInstance);
  currentUser = null;
}

export function getCurrentUser() {
  return currentUser;
}

export async function getCurrentIdToken() {
  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken();
}

export function isAuthEnabled() {
  return authEnabled;
}
