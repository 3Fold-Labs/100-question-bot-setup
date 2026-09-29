// Saving answers to a file, and loading them from one with a question before replacing saved answers.
import {fileNames, backupTrack, normalizePolicy} from '../../core/questionnaire.mjs';
import {$, message, scrollToElement} from '../lib/dom.mjs';
import {downloadFile} from '../lib/files.mjs';
import {states, trackSaved, reloadTrack, saveChange, replaceState, hasContent} from '../store/answers.mjs';
import {track, currentState, trackLabel, showTrack, redrawTrack} from '../store/open-track.mjs';
import {barNote} from '../page/bar.mjs';

const IMPORT_LIMIT = 16 * 1024 * 1024;

// Load my answers from a file sits near the top of the track (from 'top') and in More options (from 'bottom').
// Its messages and the replace question appear beside the one used.
const IMPORT_STATUS = {top: 'suggest-status', bottom: 'notice'};

// A loaded file waiting for the user to confirm it may replace saved answers.
let pendingBackup = null;

export function downloadBackup() {
  const name = fileNames(track).backup;
  downloadFile(name, JSON.stringify(currentState(), null, 2), 'application/json');
  message(`Downloaded ${name}. Use Load my answers from a file with it to bring back your ${trackLabel()} answers.`);
}

export function downloadBackupFromBar() {
  downloadBackup();
  barNote(`Downloaded ${fileNames(track).backup}.`);
}

export async function onBackupChosen(event, from) {
  const input = event.target;
  const file = input.files[0];
  if (!file) return;
  cancelBackup();
  try {
    if (file.size > IMPORT_LIMIT) throw Error('The file is too large to be an answers file.');
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw Error('Choose an answers file (.json) saved from this worksheet.');
    }
    const target = backupTrack(data) || track;
    const incoming = normalizePolicy(data, target);
    reloadTrack(target);
    if (hasContent(states[target])) {
      askToReplace(target, incoming, from);
    } else {
      applyBackup(target, incoming, from);
    }
  } catch (err) {
    message('Could not load this file. ' + err.message, IMPORT_STATUS[from]);
  } finally {
    input.value = '';
  }
}

function askToReplace(target, incoming, from) {
  pendingBackup = {target, incoming, from};
  const label = trackLabel(target);
  $('import-slot-' + from).append($('import-confirm'));
  $('import-confirm-text').textContent =
    `This file holds ${label} track answers. Replace the ${label} answers saved in this browser with it?`;
  $('import-yes').textContent = `Replace ${label} answers`;
  $('import-confirm').hidden = false;
  message('', IMPORT_STATUS[from]);
  $('import-yes').focus();
}

export function cancelBackup() {
  pendingBackup = null;
  $('import-confirm').hidden = true;
}

export function confirmBackup() {
  if (!pendingBackup) return;
  const {target, incoming, from} = pendingBackup;
  cancelBackup();
  applyBackup(target, incoming, from);
}

export function declineBackup() {
  const from = pendingBackup ? pendingBackup.from : 'bottom';
  cancelBackup();
  message('Nothing loaded. Your answers are unchanged.', IMPORT_STATUS[from]);
}

// A loaded backup is saved like any edit: if the write fails, it stays pending for this visit and later edits
// build on it.
function applyBackup(target, incoming, from = 'bottom') {
  saveChange(target, state => replaceState(state, incoming));
  const saved = trackSaved(target);
  const switched = target !== track;
  if (switched) {
    showTrack(target);
    if (location.hash !== '#' + target) location.hash = target;
  } else {
    redrawTrack();
  }
  const label = trackLabel(target);
  const where = switched ? ` You are now on the ${label} track.` : '';
  message(
    saved
      ? `Loaded your ${label} track answers.${where}`
      : `Loaded your ${label} track answers for this visit only.${where} This browser is not saving them, so save your answers to a file to keep them.`,
    IMPORT_STATUS[from]
  );
  if (from === 'bottom') scrollToElement($('export'), 'start');
}
