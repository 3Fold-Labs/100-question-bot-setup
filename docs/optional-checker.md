# Optional developer checker

The normal workflow is to download the Markdown policy and give it to an agent. No connection is needed.

For developer integrations, `policy-check.mjs` and `mcp/server.mjs` expose a local `check_action` tool. The checker reads a **Personal track** answer backup (`my-agent-answers-personal.json`) and evaluates six action types, each tied to one Personal track question:

| Action | Personal track question |
| --- | --- |
| `share_address` | Can it give someone your home address, building, unit, or directions to where you are? |
| `share_phone` | Can it give someone your phone number? |
| `claim_presence` | Can it tell someone you are home, nearby, or available to meet? |
| `accept_offer` | Can it accept or counter a financial offer within a minimum price and other terms you specify? |
| `schedule_handoff` | Can it agree to a pickup, delivery, or meeting time? |
| `message_stranger` | Can it send a message to a buyer, seller, or stranger, including an apology or a new plan? |

It does not evaluate the whole 100-question policy, inspect message text, identify recipients, or execute or intercept tools. An agent can bypass an advisory check. Enforcement requires the executing tool to require the result.

Run with Node.js 20 or later and your downloaded Personal track backup:

```bash
POLICY_PATH=/absolute/path/to/my-agent-answers-personal.json node mcp/server.mjs
```

Without `POLICY_PATH`, the server looks for `my-agent-answers-personal.json` in the repository folder. A compatible local MCP client can launch `node` with the server path in `args` and the answer-file path in the `POLICY_PATH` environment variable. The server uses newline-delimited JSON-RPC on standard input and output, as specified by the [MCP stdio transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports). The tool takes `action` and, for offers, `offeredPrice`.

A missing file, a Builder track backup, or any other file returns deny with the reason "Load a Personal track answer backup." DENY, Doesn't apply, unanswered rules, and rules in a section marked as not applying return deny. ASK requires approval. Free-form scopes and additional boundaries require human review. For offers, use a complete note such as `minimum $40` and supply a finite numeric `offeredPrice` in the same currency. Missing prices, unrecognized notes, and additional conditions return ask; below-minimum offers return deny. The checker does not interpret currencies or approvals. Apply every other relevant rule before any action.
