import { STORAGE_KEYS } from "./storage";

export function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function setStoredToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token);
}

export function clearStoredToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
}

export function isTokenExpired(payload) {
  if (!payload?.expiry) {
    return true;
  }

  return new Date(payload.expiry).getTime() <= Date.now();
}
