async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : "Request failed";
    throw new Error(message);
  }

  return payload;
}

let authTokenGetter = async () => null;

export function setAuthTokenGetter(getter) {
  authTokenGetter = typeof getter === "function" ? getter : async () => null;
}

async function authHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = await authTokenGetter();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function listProfiles() {
  const response = await fetch("/api/profiles", {
    headers: await authHeaders()
  });
  return parseResponse(response);
}

export async function getProfile(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    headers: await authHeaders()
  });
  return parseResponse(response);
}

export async function getPublicProfile(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}/public`);
  return parseResponse(response);
}

export async function createProfile(payload) {
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function updateProfile(id, payload) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function deleteProfile(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders()
  });

  return parseResponse(response);
}

export async function downloadProfileQrCode(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}/qrcode`, {
    headers: await authHeaders()
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      if (payload && payload.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parse failures for binary/non-JSON responses.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : `profile-${id}-qr.pdf`;

  return { blob, fileName };
}
