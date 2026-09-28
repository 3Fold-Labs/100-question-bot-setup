import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { ACTIONS, checkAction } from "../policy-check.mjs";
import { VERSION } from "../version.mjs";

const policyPath = process.env.POLICY_PATH || new URL("../my-agent-answers-personal.json", import.meta.url);

function loadPolicy() {
  try {
    return JSON.parse(readFileSync(policyPath, "utf8"));
  } catch (error) {
    return { answers: {}, loadError: error.message };
  }
}

const tools = [
  {
    name: "check_action",
    description: "Consult the owner's Personal track answer backup before sharing a home address or phone number, saying they are home, nearby, or available, accepting or countering a financial offer, agreeing to a pickup, delivery, or meeting time, or messaging a buyer, seller, or stranger. Do the action only when decision is allow. When decision is ask, stop and get a yes for this exact action. When decision is deny, do not do it. Evaluates these six action types only. Does not inspect message text or enforce execution. Apply every other relevant rule in the owner's policy too.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: Object.keys(ACTIONS) },
        offeredPrice: { type: "number", description: "The price being accepted or countered, when action is accept_offer." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
];

function toolResult(result) {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

function handle(message) {
  if (message.method === "initialize") {
    return { jsonrpc: "2.0", id: message.id, result: { protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18"].includes(message.params?.protocolVersion) ? message.params.protocolVersion : "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "bot-permissions", version: VERSION } } };
  }
  if (message.id == null) return null;
  if (message.method === "ping") return {jsonrpc: "2.0", id: message.id, result: {}};
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id: message.id, result: { tools } };
  }
  if (message.method === "tools/call") {
    const name = message.params && message.params.name;
    const args = (message.params && message.params.arguments) || {};
    if (name !== "check_action") {
      return { jsonrpc: "2.0", id: message.id, result: toolResult({ decision: "deny", reason: "Unknown tool." }) };
    }
    const policy = loadPolicy();
    const result = checkAction(policy, args.action, args);
    if (policy?.loadError) result.policyFile = `Could not read the answer file at ${policyPath}. Every action stays denied until a Personal track answer backup is at that path.`;
    return { jsonrpc: "2.0", id: message.id, result: toolResult(result) };
  }
  if (message.id != null) {
    return { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } };
  }
  return null;
}

const input = createInterface({input: process.stdin, crlfDelay: Infinity});
input.on('line', line => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); }
  catch { process.stdout.write(JSON.stringify({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}) + '\n'); return; }
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    process.stdout.write(JSON.stringify({jsonrpc: '2.0', id: message?.id ?? null, error: {code: -32600, message: 'Invalid Request'}}) + '\n'); return;
  }
  const response = handle(message);
  if (response) process.stdout.write(JSON.stringify(response) + '\n');
});
