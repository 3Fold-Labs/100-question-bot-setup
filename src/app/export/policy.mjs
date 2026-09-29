// Downloading and copying the policy, the quick start, and the link to the worksheet.
import {WORKSHEET_URL, fileNames, QUICK_START, instructionText} from '../../core/questionnaire.mjs';
import {$, message, selectText} from '../lib/dom.mjs';
import {downloadFile, copyText} from '../lib/files.mjs';
import {track, currentState} from '../store/open-track.mjs';

export function downloadPolicy(compact, statusId = 'notice') {
  const names = fileNames(track);
  const name = compact ? names.compact : names.policy;
  downloadFile(name, instructionText(currentState(), track, {compact}), 'text/markdown');
  message(`Downloaded ${name}. Give it to your agent and say: “Follow this policy.”`, statusId);
}

export async function copyPolicy() {
  try {
    await copyText(instructionText(currentState(), track));
    message('Policy copied. Paste it into your agent’s chat or instructions, then send the quick start.');
  } catch {
    const output = $('output');
    $('more-options').open = true;
    output.closest('details').open = true;
    selectText(output);
    message('Automatic copy is unavailable here. Your policy is selected below; copy it with your keyboard.');
  }
}

export async function copyQuickStart() {
  try {
    await copyText(QUICK_START);
    message('Quick start copied. Send it with the policy file attached.', 'quick-start-status');
  } catch {
    selectText($('quick-start'));
    message(
      'Automatic copy is unavailable here. The quick start is selected; copy it with your keyboard.',
      'quick-start-status'
    );
  }
}

export async function copyLink() {
  try {
    await copyText(WORKSHEET_URL);
    $('share-link-box').hidden = true;
    message(`Link copied: ${WORKSHEET_URL}`, 'share-status');
  } catch {
    $('share-link-box').hidden = false;
    selectText($('share-link-text'));
    message(
      'Automatic copy is unavailable here. The link is selected below; copy it with your keyboard.',
      'share-status'
    );
  }
}
