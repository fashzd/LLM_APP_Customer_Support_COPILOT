import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTicket } from "../server/analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const schemaPath = path.join(rootDir, "AI_OUTPUT_SCHEMA.json");
const promptSpecPath = path.join(rootDir, "PROMPT_SPEC.md");
const regressionTicketsPath = path.join(rootDir, "regression-tickets.json");

async function loadRegressionTickets() {
  return JSON.parse(await readFile(regressionTicketsPath, "utf8"));
}

async function analyzeWithHeuristic(ticket) {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    return await analyzeTicket({
      ticket,
      schemaPath,
      promptSpecPath
    });
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
}

test("regression ticket set matches expected categories and escalation decisions", async () => {
  const tickets = await loadRegressionTickets();

  for (const ticket of tickets) {
    const { recommendation, meta } = await analyzeWithHeuristic(ticket);

    assert.equal(recommendation.category, ticket.expected_category, ticket.id);
    assert.equal(recommendation.escalation_decision, ticket.expected_escalation_decision, ticket.id);
    assert.equal(meta.validation.valid, true, ticket.id);
  }
});

test("ambiguous return-vs-refund regression case falls back to out of scope", async () => {
  const tickets = await loadRegressionTickets();
  const ticket = tickets.find((entry) => entry.id === "reg-return-vs-refund-ambiguous-001");
  const { recommendation } = await analyzeWithHeuristic(ticket);

  assert.equal(recommendation.category, "Out of scope");
  assert.equal(recommendation.escalation_decision, "Escalate");
});

test("legal-risk refund regression case stays in refund but escalates", async () => {
  const tickets = await loadRegressionTickets();
  const ticket = tickets.find((entry) => entry.id === "reg-legal-risk-001");
  const { recommendation } = await analyzeWithHeuristic(ticket);

  assert.equal(recommendation.category, "Refund request");
  assert.equal(recommendation.escalation_decision, "Escalate");
});
