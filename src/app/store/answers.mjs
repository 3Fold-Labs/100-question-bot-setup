// Each track's answers: loading, saving without losing edits, changes saved by other open copies of the page, and
// saved data that cannot be read. Everything that shows answers subscribes with onAnswersChange.
import {TRACK_IDS, PROFILE_FIELDS, emptyPolicy, normalizePolicy} from '../../core/questionnaire.mjs';
import {
  STORAGE_KEYS,
  OLDER_STORAGE_KEYS,
  storageProbeOk,
  readStorage,
  writeStorage,
  removeStorage,
  storageKeyList
} from './browser-storage.mjs';

// Each track's answers as this copy of the page shows them.
export const states = {};
// Tracks whose unreadable saved data could not be set aside. Their stored key is never written.
const lockedTracks = new Set();
const heldAside = {builder: [], personal: []};
// Tracks whose unreadable data notice was hidden. Setting more data aside shows it again.
const hiddenNotices = new Set();
// Edits not yet written to storage, per track, in the order they were made. Each is replayed onto the latest
// saved answers until a write succeeds, so a failed save never drops an earlier edit.
const pending = {builder: [], personal: []};
// The latest answers known to be in storage (or loaded when the page opened), per track.
const baseline = {};
// The result of each track's last write: true, false, or null before its first write this visit.
const lastWrite = {builder: null, personal: null};

const listeners = [];

// Calls listener(trackId) after a track's answers change, or listener(null) when another copy changed storage.
export function onAnswersChange(listener) {
  listeners.push(listener);
}

function notify(trackId) {
  for (const listener of listeners) listener(trackId);
}

function asideKey(trackId) {
  return STORAGE_KEYS[trackId] + '-unreadable';
}

// Saved data that cannot be read is never overwritten. It moves to <key>-unreadable (or the next free
// numbered key), and the track starts empty. If it cannot be moved, the track is never written.
function keepAside(trackId, raw) {
  const base = asideKey(trackId);
  let key = base;
  for (let n = 2; readStorage(key) != null; n++) key = `${base}-${n}`;
  if (writeStorage(key, raw) && readStorage(key) === raw) {
    removeStorage(STORAGE_KEYS[trackId]);
  } else {
    lockedTracks.add(trackId);
    heldAside[trackId].push(raw);
  }
  hiddenNotices.delete(trackId);
}

export function keptAside(trackId) {
  const base = asideKey(trackId);
  const suffix = key => (key === base ? 1 : Number(key.slice(base.length + 1)));
  const keys = storageKeyList()
    .filter(key => key === base || (key.startsWith(base + '-') && /^\d+$/.test(key.slice(base.length + 1))))
    .sort((a, b) => suffix(a) - suffix(b));
  const stored = keys.map(key => ({key, raw: readStorage(key)})).filter(item => item.raw != null);
  return [...stored, ...heldAside[trackId].map(raw => ({key: STORAGE_KEYS[trackId], raw}))];
}

export function hideUnreadableNotice(trackId) {
  hiddenNotices.add(trackId);
}

export function unreadableNoticeHidden(trackId) {
  return hiddenNotices.has(trackId);
}

// The latest saved answers for a track, or null when nothing readable is saved.
function storedState(trackId) {
  if (lockedTracks.has(trackId)) return null;
  const raw = readStorage(STORAGE_KEYS[trackId]);
  if (raw == null) return null;
  try {
    return normalizePolicy(JSON.parse(raw), trackId);
  } catch {
    keepAside(trackId, raw);
    return null;
  }
}

function loadTrackState(trackId) {
  if (readStorage(STORAGE_KEYS[trackId]) != null) return storedState(trackId) || emptyPolicy(trackId);
  for (const key of OLDER_STORAGE_KEYS) {
    const older = readStorage(key);
    if (!older) continue;
    try {
      const filled = normalizePolicy(JSON.parse(older), trackId);
      writeStorage(STORAGE_KEYS[trackId], JSON.stringify(filled));
      return filled;
    } catch {
      continue;
    }
  }
  return emptyPolicy(trackId);
}

// Reads both tracks' saved answers when the page opens.
export function loadTracks() {
  for (const trackId of TRACK_IDS) {
    states[trackId] = loadTrackState(trackId);
    baseline[trackId] = cloneState(states[trackId]);
  }
}

function writeTrack(trackId, state) {
  if (lockedTracks.has(trackId)) return false;
  lastWrite[trackId] = writeStorage(STORAGE_KEYS[trackId], JSON.stringify(state));
  return lastWrite[trackId];
}

// A track's answers are saved when it is not locked, has no pending edits, and its last write succeeded (or, before
// any write, when this browser accepted the test write). Each track has its own status: a save on one track never
// clears another track's warning.
export function trackSaved(trackId) {
  if (lockedTracks.has(trackId) || pending[trackId].length) return false;
  return lastWrite[trackId] ?? storageProbeOk;
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

// The latest saved answers with this copy's unsaved edits applied on top.
function withPending(trackId, base) {
  const state = cloneState(base);
  for (const apply of pending[trackId]) apply(state);
  return state;
}

// Reads the latest saved answers for a track into this copy, keeping any edits that are not saved yet.
export function reloadTrack(trackId) {
  const stored = storedState(trackId);
  if (stored) baseline[trackId] = stored;
  states[trackId] = withPending(trackId, baseline[trackId] || emptyPolicy(trackId));
}

// Every edit reads the latest saved answers for the track, applies the edits this copy has not saved yet and then
// this one, and writes the result, so two open copies never overwrite each other's answers. The edits stay
// pending until a write succeeds.
export function saveChange(trackId, apply) {
  const stored = storedState(trackId);
  if (stored) baseline[trackId] = stored;
  pending[trackId].push(apply);
  const state = cloneState(baseline[trackId] || emptyPolicy(trackId));
  let result;
  pending[trackId].forEach((step, i) => {
    const out = step(state);
    if (i === pending[trackId].length - 1) result = out;
  });
  states[trackId] = state;
  if (writeTrack(trackId, state)) {
    pending[trackId] = [];
    baseline[trackId] = cloneState(state);
  }
  notify(trackId);
  return result;
}

// Replaces every field of a state with another state's, in place.
export function replaceState(state, next) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, cloneState(next));
}

// Another open copy of this page saved answers: show them here.
export function onStorage(event) {
  const key = event.key;
  const affected =
    key == null ? TRACK_IDS : TRACK_IDS.filter(t => key === STORAGE_KEYS[t] || key.startsWith(asideKey(t)));
  if (!affected.length) return;
  for (const trackId of affected) {
    if (key != null && key !== STORAGE_KEYS[trackId]) continue;
    if (lockedTracks.has(trackId)) continue;
    const raw = readStorage(STORAGE_KEYS[trackId]);
    if (raw == null) {
      baseline[trackId] = emptyPolicy(trackId);
    } else {
      try {
        baseline[trackId] = normalizePolicy(JSON.parse(raw), trackId);
      } catch {
        // Unreadable data is set aside the next time this copy reads or saves the track.
        continue;
      }
    }
    states[trackId] = withPending(trackId, baseline[trackId]);
    // Another copy could save, so try again to save this copy's pending edits.
    if (pending[trackId].length && writeTrack(trackId, states[trackId])) {
      pending[trackId] = [];
      baseline[trackId] = cloneState(states[trackId]);
    }
  }
  notify(null);
}

export function hasContent(state) {
  const answered = Object.values(state.answers).some(a => a.choice || a.notes);
  const fields = PROFILE_FIELDS.some(({key}) => state[key]);
  return answered || fields || Boolean(state.exceptions) || state.off.length > 0;
}

export function hasAnswers(state) {
  return Object.values(state.answers).some(a => a.choice);
}
