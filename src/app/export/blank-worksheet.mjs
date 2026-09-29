// The blank worksheet download: a copy of the page as it arrived, with both tracks and no answers.
import {BLANK_FILE_NAME} from '../../core/questionnaire.mjs';
import {message} from '../lib/dom.mjs';
import {downloadFile} from '../lib/files.mjs';

// Taken when this module loads, before anything renders.
const pristineRoot = document.documentElement.cloneNode(true);

function blankWorksheetHtml() {
  const root = pristineRoot.cloneNode(true);
  root.removeAttribute('data-theme');
  root.removeAttribute('style');
  root.setAttribute('data-blank', 'true');
  return '<!doctype html>\n' + root.outerHTML;
}

export function downloadBlank(statusId) {
  downloadFile(BLANK_FILE_NAME, blankWorksheetHtml(), 'text/html');
  message('Blank worksheet downloaded with both tracks. Your answers here stay as they are.', statusId);
}
