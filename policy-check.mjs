import {TRACKS, POLICY_IDS, SCHEMA, normalizePolicy, effectiveAnswer} from './questionnaire.mjs';

// Each action is tied to the Personal track question with exactly this text.
const ACTION_QUESTIONS = {
  share_address: 'Can it give someone your home address, building, unit, or directions to where you are?',
  share_phone: 'Can it give someone your phone number?',
  claim_presence: 'Can it tell someone you are home, nearby, or available to meet?',
  accept_offer: 'Can it accept or counter a financial offer within a minimum price and other terms you specify?',
  schedule_handoff: 'Can it agree to a pickup, delivery, or meeting time?',
  message_stranger: 'Can it send a message to a buyer, seller, or stranger, including an apology or a new plan?'
};
export const ACTIONS = Object.fromEntries(Object.entries(ACTION_QUESTIONS).map(([action, text]) => {
  const q = TRACKS.personal.questions.find(q => q.question === text);
  if (!q) throw Error(`The Personal track has no question for ${action}.`);
  return [action, {id: q.id, question: q.question}];
}));

const WRONG_FILE = 'Load a Personal track answer backup.';

// Only a complete, explicitly labeled price constraint is machine-readable.
export function parseMinimum(notes) {
  const match = String(notes || '').trim().match(/^(?:minimum|lowest|min\.?|floor)\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/i);
  return match ? Number(match[1]) : null;
}

export function checkAction(policy, action, context = {}) {
  const spec = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
  if (!spec) return {decision: 'deny', action, reason: 'Unknown action.'};
  if (!policy || typeof policy !== 'object' || policy.schema !== SCHEMA || policy.policyId !== POLICY_IDS.personal || policy.track !== 'personal') {
    return {decision: 'deny', action, reason: WRONG_FILE};
  }
  let clean;
  try { clean = normalizePolicy(policy, 'personal'); }
  catch { return {decision: 'deny', action, reason: WRONG_FILE}; }
  const question = TRACKS.personal.questions.find(q => q.id === spec.id);
  const {choice, notes} = effectiveAnswer(clean, 'personal', question);
  const base = {action, ruleId: spec.id, question: spec.question, choice: choice || 'UNANSWERED', notes};
  if (!choice || choice === 'DENY' || choice === 'N/A') return {...base, decision: 'deny', reason: 'This rule grants no permission.'};
  if (choice === 'ASK') return {...base, decision: 'ask', reason: 'Get approval for this exact action before executing it.'};
  if (clean.exceptions.trim()) return {...base, decision: 'ask', reason: 'Additional boundaries require human review; this checker cannot interpret them.'};
  if (action === 'accept_offer') {
    const minimum = parseMinimum(notes);
    if (minimum == null) return {...base, decision: 'ask', reason: 'Record an explicit minimum such as minimum $40; other terms require human review.'};
    if (typeof context?.offeredPrice !== 'number' || !Number.isFinite(context.offeredPrice) || context.offeredPrice < 0) return {...base, decision: 'ask', reason: 'A valid offeredPrice is required to check the minimum.'};
    if (context.offeredPrice < minimum) return {...base, decision: 'deny', reason: `The offer is below the minimum of ${minimum}.`};
  } else if (notes.trim()) {
    return {...base, decision: 'ask', reason: 'Written scope requires human review; this checker does not evaluate recipients, message text, or free-form notes.'};
  }
  return {...base, decision: 'allow', reason: 'This individual rule allows the action. Apply all other relevant rules before execution.'};
}
