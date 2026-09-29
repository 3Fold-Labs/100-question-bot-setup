// Which track is open, and the hooks features use to put a track on screen without importing the router.
import {TRACKS, TRACK_IDS} from '../../core/questionnaire.mjs';
import {states} from './answers.mjs';

// The open track, or null on the start page. Only the router changes it, through setTrack.
export let track = null;

export function setTrack(trackId) {
  track = trackId;
}

export function currentState() {
  return states[track];
}

export function trackLabel(trackId = track) {
  return TRACKS[trackId].label;
}

export function otherTrack(trackId = track) {
  return TRACK_IDS.find(id => id !== trackId);
}

// The router registers how it opens a track and redraws the open one when the page starts.
const trackView = {open: null, redraw: null};

export function registerTrackView(hooks) {
  Object.assign(trackView, hooks);
}

export function showTrack(trackId) {
  trackView.open(trackId);
}

export function redrawTrack() {
  trackView.redraw();
}
