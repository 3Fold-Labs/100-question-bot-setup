// localStorage access and every key the page stores. Each call survives a browser that blocks storage.

export const STORAGE_KEYS = {builder: '3fold-agent-policy-builder', personal: '3fold-agent-policy-personal'};
export const OLDER_STORAGE_KEYS = ['3fold-public-permissions-v3', '3fold-public-permissions-v1'];
export const TRACK_KEY = '3fold-agent-policy-track';
export const THEME_KEY = 'bot-permissions-theme';
export const CODING_TOOL_KEY = '3fold-agent-policy-coding-tool';
// Followed by the track id: the rules the user confirmed are in each coding tool's file.
export const TOOL_RULES_KEY = '3fold-agent-policy-tool-rules-';
const PROBE_KEY = '3fold-agent-policy-storage-check';

// Whether this browser accepted a test write when the page opened.
export let storageProbeOk = true;

export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function storageKeyList() {
  try {
    return Array.from({length: localStorage.length}, (_, i) => localStorage.key(i)).filter(Boolean);
  } catch {
    return [];
  }
}

export function probeStorage() {
  storageProbeOk = writeStorage(PROBE_KEY, '1');
  if (storageProbeOk) removeStorage(PROBE_KEY);
}
