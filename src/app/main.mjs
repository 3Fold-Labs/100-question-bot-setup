// Starts the page: loads saved answers, connects every control to its feature, and opens the first view.
import {VERSION} from '../core/version.mjs';
import {WORKSHEET_URL, QUICK_START} from '../core/questionnaire.mjs';
import {$} from './lib/dom.mjs';
import {probeStorage} from './store/browser-storage.mjs';
import {loadTracks, onAnswersChange, onStorage} from './store/answers.mjs';
import {track, registerTrackView} from './store/open-track.mjs';
import {setLandingHero} from './page/hero.mjs';
import {syncBarHeight, goToDownloads} from './page/bar.mjs';
import {toggleToc, trackActiveSection} from './page/contents.mjs';
import {currentTheme, applyTheme, toggleTheme} from './page/theme.mjs';
import {updateScrollRing, bindScrollRing} from './page/scroll-ring.mjs';
import {updateShadow, queueShadow} from './page/card-shadows.mjs';
import {fillSuggestions} from './worksheet/sections.mjs';
import {nextUnanswered} from './worksheet/questions.mjs';
import {bindFields} from './worksheet/profile.mjs';
import {renderReviewPanel, goToBoundaries} from './review/before-download.mjs';
import {chooseCodingTool} from './tool-settings/panel.mjs';
import {downloadToolFile, copyToolSnippet, confirmToolApplied} from './tool-settings/actions.mjs';
import {downloadPolicy, copyPolicy, copyQuickStart, copyLink} from './export/policy.mjs';
import {
  downloadBackup,
  downloadBackupFromBar,
  onBackupChosen,
  confirmBackup,
  declineBackup
} from './export/answers-file.mjs';
import {downloadBlank} from './export/blank-worksheet.mjs';
import {downloadUnreadable, hideUnreadable} from './export/unreadable.mjs';
import {askToClear, clearTrack, declineClear} from './export/clear-track.mjs';
import {initialTrack, route, showPicker, openTrack, chooseTrack, goHome, switchTrack} from './router.mjs';
import {renderTrack} from './render.mjs';

function onScroll() {
  updateScrollRing();
  trackActiveSection();
  queueShadow();
}

function onResize() {
  syncBarHeight();
  updateScrollRing();
  queueShadow();
}

function bindControls() {
  $('theme-toggle').addEventListener('click', toggleTheme);
  for (const tile of document.querySelectorAll('.track-tile')) {
    tile.addEventListener('click', () => chooseTrack(tile.dataset.track));
  }
  $('switch-track').addEventListener('click', switchTrack);
  $('next-unanswered').addEventListener('click', nextUnanswered);
  $('go-downloads').addEventListener('click', goToDownloads);
  $('storage-backup').addEventListener('click', downloadBackupFromBar);
  $('cta-blank').addEventListener('click', () => downloadBlank('hero-status'));
  $('share-blank-btn').addEventListener('click', () => downloadBlank('share-status'));
  $('copy-link').addEventListener('click', copyLink);
  $('suggest').addEventListener('click', fillSuggestions);
  $('toc-toggle').addEventListener('click', toggleToc);
  $('download-policy').addEventListener('click', () => downloadPolicy(false));
  $('download-compact').addEventListener('click', () => downloadPolicy(true));
  $('tool-download-compact').addEventListener('click', () => downloadPolicy(true, 'tool-status'));
  $('copy-policy').addEventListener('click', copyPolicy);
  $('copy-quick-start').addEventListener('click', copyQuickStart);
  for (const button of document.querySelectorAll('.tool-download'))
    button.addEventListener('click', () => downloadToolFile(button.dataset.file));
  for (const button of document.querySelectorAll('.tool-copy'))
    button.addEventListener('click', () => copyToolSnippet(button.dataset.snippet, button.dataset.part));
  for (const button of document.querySelectorAll('.tool-confirm'))
    button.addEventListener('click', () => confirmToolApplied(button.dataset.confirm));
  for (const input of document.querySelectorAll('input[name="coding-tool"]'))
    input.addEventListener('change', () => chooseCodingTool(input.value));
  for (const group of document.querySelectorAll('.review-group'))
    group.addEventListener('toggle', () => {
      if (track) renderReviewPanel();
    });
  $('review-boundaries-link').addEventListener('click', goToBoundaries);
  $('download-backup').addEventListener('click', downloadBackup);
  $('load-backup').addEventListener('change', event => onBackupChosen(event, 'bottom'));
  $('load-backup-top').addEventListener('change', event => onBackupChosen(event, 'top'));
  $('import-yes').addEventListener('click', confirmBackup);
  $('import-no').addEventListener('click', declineBackup);
  $('unreadable-download').addEventListener('click', downloadUnreadable);
  $('unreadable-hide').addEventListener('click', hideUnreadable);
  $('clear-answers').addEventListener('click', askToClear);
  $('clear-yes').addEventListener('click', clearTrack);
  $('clear-no').addEventListener('click', declineClear);
  $('home-link').addEventListener('click', goHome);
  bindFields();
  bindScrollRing();
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', onStorage);
  window.addEventListener('scroll', onScroll, {passive: true});
  window.addEventListener('resize', onResize, {passive: true});
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(updateScrollRing).observe(document.body);
    new ResizeObserver(syncBarHeight).observe($('bar'));
  }
}

function init() {
  $('js-needed').hidden = true;
  $('hero-title').tabIndex = -1;
  setLandingHero({title: $('hero-title').innerHTML, lede: $('hero-lede').textContent});
  registerTrackView({open: openTrack, redraw: renderTrack});
  onAnswersChange(trackId => {
    if (trackId == null || trackId === track) renderTrack();
  });
  probeStorage();
  loadTracks();
  $('footer-name').textContent = `100-Question AI Agent Setup · ${VERSION} · 3Fold Labs`;
  $('quick-start').textContent = QUICK_START;
  $('share-link-text').value = WORKSHEET_URL;
  applyTheme(currentTheme());
  bindControls();
  const first = initialTrack();
  if (first) {
    openTrack(first);
  } else {
    showPicker();
  }
  updateShadow();
  updateScrollRing();
}

init();
