// Downloading and copying tool settings, and confirming a file now holds them.
import {TOOL_FILE_NAMES, TOOL_PATHS, TOOL_SHARED_FILES, compileToolSettings} from '../../core/compiler.mjs';
import {$, message, selectText} from '../lib/dom.mjs';
import {downloadFile, copyText} from '../lib/files.mjs';
import {currentState} from '../store/open-track.mjs';
import {lastToolRules, toolUpdating, recordToolRules} from './installed-rules.mjs';
import {renderToolSettings} from './panel.mjs';

const TOOL_FILE_TYPES = {
  claude: 'application/json',
  codexRules: 'text/plain',
  codexConfig: 'application/toml',
  gemini: 'application/toml',
  cursor: 'application/json'
};

// Downloading or copying a file is never a confirmation, for any tool: creating a download or a clipboard copy
// (including one that fails) is not evidence the user has actually replaced or updated the file on disk. The
// record of what is installed advances only when the user presses that tool's confirm button.
export function downloadToolFile(key) {
  const name = TOOL_FILE_NAMES[key];
  downloadFile(name, compileToolSettings(currentState()).files[key], TOOL_FILE_TYPES[key]);
  const replace = key === 'codexRules' || key === 'gemini' ? ', replacing the whole file if you already have one' : '';
  message(`Downloaded ${name}. Save it as ${TOOL_PATHS[key]}${replace}.`, 'tool-status');
}

// Copies the rules as shown: the remove or add block for Claude Code and Cursor, or the rules for the others.
export async function copyToolSnippet(key, part) {
  const node = $((part === 'remove' ? 'remove-' : 'snippet-') + key);
  const text = node.textContent;
  const shared = TOOL_SHARED_FILES.includes(key);
  const update = shared && toolUpdating(key);
  const done =
    part === 'remove'
      ? 'Rules to remove copied. Find and delete them in your settings file.'
      : key === 'codexConfig'
        ? 'Config lines copied. Set them in your config.toml.'
        : key === 'codexRules' || key === 'gemini'
          ? 'Rules copied. Replace everything in your rules file with them.'
          : update
            ? 'Rules to add copied. Add them to your settings file.'
            : 'Rules copied. Add them to your existing settings file.';
  try {
    await copyText(text);
    message(done, 'tool-status');
  } catch {
    selectText(node);
    message('Automatic copy is unavailable here. The rules are selected; copy them with your keyboard.', 'tool-status');
  }
}

// The user says the file now matches (added, updated, or replaced), so the record of what is installed advances to
// the rules shown right now. Nothing else advances it, so an interrupted update stays visible until this is pressed.
// When the browser cannot save that record, this never reports success and never hides the pending update: the
// comparison still shows exactly what differs, using the last record that was actually saved.
export function confirmToolApplied(tool) {
  const first = !lastToolRules(tool);
  const saved = recordToolRules(tool);
  renderToolSettings();
  if (!saved) {
    message('Your browser could not save this. Save my answers to a file to keep your work.', 'tool-status');
    return;
  }
  const replaced = tool === 'codex' || tool === 'gemini';
  message(
    replaced ? 'Marked as replaced.' : first ? 'Marked as added to your file.' : 'Marked as updated in your file.',
    'tool-status'
  );
}
