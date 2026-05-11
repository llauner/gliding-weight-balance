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

export async function listProfiles() {
  const response = await fetch("/api/profiles");
  return parseResponse(response);
}

export async function getProfile(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`);
  return parseResponse(response);
}

export async function createProfile(payload) {
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function updateProfile(id, payload) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function deleteProfile(id) {
  const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  return parseResponse(response);
}
