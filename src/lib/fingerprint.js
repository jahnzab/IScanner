import { STORAGE_KEYS } from "./storage";

async function hash(input) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceFingerprint() {
  const cached = localStorage.getItem(STORAGE_KEYS.deviceId);

  if (cached) {
    return cached;
  }

  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    window.screen.width,
    window.screen.height,
    window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join("|");

  const digest = await hash(raw);
  localStorage.setItem(STORAGE_KEYS.deviceId, digest);
  return digest;
}
