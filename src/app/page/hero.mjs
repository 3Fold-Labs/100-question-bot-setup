// The headline on the start page and each track, and the labels and file names that name the open track.
import {TRACKS, BLANK_FILE_NAME, fileNames} from '../../core/questionnaire.mjs';
import {$} from '../lib/dom.mjs';
import {track, trackLabel, otherTrack} from '../store/open-track.mjs';

const HERO = {
  builder: {
    title: 'Set the rules for the AI you code and build with.',
    lede: '100 questions decide what Claude Code, Cursor, Codex, Lovable, Bolt, Replit, and other coding agents can do with your code, data, deploys, and accounts, what needs your approval, and what is off limits. Answer in any order, then download a policy to give each agent.'
  },
  personal: {
    title: 'Set the rules for the AI in your everyday life.',
    lede: '100 questions decide what Muse, ChatGPT, Claude, Gemini, Grok, and assistants that handle your email, calendar, shopping, messages, and selling can do, what needs your approval, and what is off limits. Answer in any order, then download a policy to give each assistant.'
  }
};

// The start page's own title and lede, read from the page when it opens and shown again whenever no track is open.
let landingHero = null;

export function setLandingHero(hero) {
  landingHero = hero;
}

export function renderHero() {
  const eyebrow = $('hero-track');
  if (!track) {
    eyebrow.hidden = true;
    $('hero-title').innerHTML = landingHero.title;
    $('hero-lede').textContent = landingHero.lede;
    return;
  }
  eyebrow.hidden = false;
  eyebrow.textContent = `${trackLabel()} track · ${TRACKS[track].title}`;
  $('hero-title').textContent = HERO[track].title;
  $('hero-lede').textContent = HERO[track].lede;
}

export function renderTrackText() {
  const label = trackLabel();
  const names = fileNames(track);
  $('bar-track').textContent = label;
  $('switch-track').textContent = `Switch to ${trackLabel(otherTrack())}`;
  $('track-eyebrow').textContent = `${label} track · 100 questions`;
  $('fn-policy').textContent = names.policy;
  $('fn-compact').textContent = names.compact;
  $('fn-backup').textContent = names.backup;
  $('fn-blank').textContent = BLANK_FILE_NAME;
  const builder = track === 'builder';
  $('policy-guidance').textContent = builder
    ? 'For a coding agent, the recommended pair is the compact policy in its instructions plus your coding tool settings.'
    : 'Use the compact policy where an agent accepts only brief instructions.';
  $('personal-tools-note').hidden = builder;
  $('exceptions-tools-note').hidden = !builder;
  $('tool-settings').hidden = !builder;
  $('where-coding').hidden = !builder;
  $('clear-answers').textContent = `Clear ${label} answers`;
  $('clear-text').textContent =
    `Removes every ${label} track answer, note, section choice, profile field, and additional boundary saved in this browser. Your other track and your downloaded files stay as they are.`;
}
