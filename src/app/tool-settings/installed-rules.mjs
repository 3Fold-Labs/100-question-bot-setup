// The rules the user has told us are in each coding tool's file, per track, saved in this browser.
import {compileToolSettings, ruleChanges} from '../../core/compiler.mjs';
import {TOOL_RULES_KEY, readStorage, writeStorage} from '../store/browser-storage.mjs';
import {track, currentState} from '../store/open-track.mjs';

function storedToolRules() {
  try {
    const all = JSON.parse(readStorage(TOOL_RULES_KEY + track) || '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

export function lastToolRules(tool) {
  const list = storedToolRules()[tool];
  return Array.isArray(list) && list.every(e => e && typeof e.key === 'string' && typeof e.decision === 'string')
    ? list
    : null;
}

export // Whether a Claude Code or Cursor file needs rules removed or added since the rules were last recorded as installed.
function toolUpdating(tool) {
  const current = compileToolSettings(currentState(), {date: ''}).rules[tool];
  const base = lastToolRules(tool);
  if (!base) return false;
  const {add, remove} = ruleChanges(base, current);
  return Boolean(add.length || remove.length);
}

// Records the current rules as the ones now installed for this tool, in this browser. Only an explicit confirmation
// calls this: downloading a file, copying a block, and a failed clipboard copy never do, so an interrupted update
// keeps comparing against what is actually still in the file until the user says the file matches. Returns whether
// the write actually succeeded, so a caller never reports success when the record could not be saved.
export function recordToolRules(tool) {
  const current = compileToolSettings(currentState(), {date: ''}).rules[tool];
  const all = storedToolRules();
  all[tool] = current.map(({key, decision}) => ({key, decision}));
  return writeStorage(TOOL_RULES_KEY + track, JSON.stringify(all));
}
