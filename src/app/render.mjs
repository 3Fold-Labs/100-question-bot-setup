// Redraws everything on the open track that depends on its answers.
import {track} from './store/open-track.mjs';
import {barNote, renderStorageStatus} from './page/bar.mjs';
import {updateGroupTiles, updateSectionCounts} from './worksheet/sections.mjs';
import {syncQuestions} from './worksheet/questions.mjs';
import {fillFields} from './worksheet/profile.mjs';
import {renderProgress} from './worksheet/progress.mjs';
import {renderReviewPanel} from './review/before-download.mjs';
import {renderTestPrompts} from './review/agent-tests.mjs';
import {renderBothTracks} from './review/both-tracks.mjs';
import {renderToolSettings} from './tool-settings/panel.mjs';
import {renderUnreadable} from './export/unreadable.mjs';

export function renderTrack() {
  if (!track) return;
  barNote('');
  fillFields();
  syncQuestions();
  renderProgress();
  updateGroupTiles();
  updateSectionCounts();
  renderReviewPanel();
  renderTestPrompts();
  renderBothTracks();
  renderToolSettings();
  renderUnreadable();
  renderStorageStatus();
}
