import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTicket } from "../server/analyzer.js";
import { isValidAgainstSchema } from "../server/schemaValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const schemaPath = path.join(rootDir, "AI_OUTPUT_SCHEMA.json");
const promptSpecPath = path.join(rootDir, "PROMPT_SPEC.md");
const sampleTicketsPath = path.join(rootDir, "sample-tickets.json");

async function loadSchema() {
  return JSON.parse(await readFile(schemaPath, "utf8"));
}

async function loadSampleTickets() {
  return JSON.parse(await readFile(sampleTicketsPath, "utf8"));
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

test("supported sample tickets return the expected category and escalation decision", async () => {
  const sampleTickets = await loadSampleTickets();
  const supportedTickets = sampleTickets.filter((ticket) => ticket.expected_category !== "Out of scope");

  for (const ticket of supportedTickets) {
    const { recommendation, meta } = await analyzeWithHeuristic(ticket);

    assert.equal(recommendation.category, ticket.expected_category, ticket.id);
    assert.equal(recommendation.escalation_decision, ticket.expected_escalation_decision, ticket.id);
    assert.equal(meta.validation.valid, true, ticket.id);
  }
});

test("out-of-scope sample tickets escalate", async () => {
  const sampleTickets = await loadSampleTickets();
  const outOfScopeTickets = sampleTickets.filter((ticket) => ticket.expected_category === "Out of scope");

  for (const ticket of outOfScopeTickets) {
    const { recommendation } = await analyzeWithHeuristic(ticket);

    assert.equal(recommendation.category, "Out of scope", ticket.id);
    assert.equal(recommendation.escalation_decision, "Escalate", ticket.id);
  }
});

test("schema validator accepts a valid recommendation and rejects an invalid one", async () => {
  const schema = await loadSchema();
  const validRecommendation = {
    category: "Refund request",
    urgency: "Medium",
    customer_issue_summary: "The customer wants a refund for a delayed delivery.",
    suggested_reply: "Thanks for reaching out. I can help review your refund request.",
    policy_source_used: "Refund policy - delayed delivery review",
    missing_information: ["Whether the item was kept or returned"],
    escalation_decision: "Do not escalate",
    escalation_reason: "This is a standard supported request."
  };
  const invalidRecommendation = {
    category: "Refund request",
    urgency: "Urgent",
    customer_issue_summary: "",
    suggested_reply: "Done.",
    policy_source_used: "Refund policy",
    missing_information: "Order number",
    escalation_decision: "Maybe",
    escalation_reason: ""
  };

  const validResult = isValidAgainstSchema(schema, validRecommendation);
  const invalidResult = isValidAgainstSchema(schema, invalidRecommendation);

  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.errors, []);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.some((error) => error.includes("urgency must be one of")));
  assert.ok(invalidResult.errors.some((error) => error.includes("missing_information must be an array")));
  assert.ok(invalidResult.errors.some((error) => error.includes("escalation_decision must be one of")));
});

test("invalid model output triggers the safe fallback response", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      output_text: "{\"foo\":\"bar\"}"
    })
  });

  try {
    const ticket = {
      subject: "Need help",
      body: "Please help with my return",
      order_id: "",
      order_status: "",
      customer_history: "",
      policy_snippet: ""
    };

    const { recommendation, meta } = await analyzeTicket({
      ticket,
      schemaPath,
      promptSpecPath
    });

    assert.equal(meta.validation.valid, false);
    assert.equal(recommendation.category, "Out of scope");
    assert.equal(recommendation.escalation_decision, "Escalate");
    assert.equal(recommendation.policy_source_used, "Safe fallback response based on supported ticket handling rules");
    assert.ok(recommendation.escalation_reason.includes("did not pass schema validation"));
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    global.fetch = originalFetch;
  }
});

test("out-of-scope account-access tickets return context-aware missing information", async () => {
  const sampleTickets = await loadSampleTickets();
  const ticket = sampleTickets.find((entry) => entry.id === "oos-001");
  const { recommendation } = await analyzeWithHeuristic(ticket);

  assert.equal(recommendation.category, "Out of scope");
  assert.equal(recommendation.escalation_decision, "Escalate");
  assert.ok(recommendation.missing_information.includes("Account email address"));
  assert.ok(recommendation.missing_information.includes("Safe verification details required by the support team"));
  assert.ok(!recommendation.missing_information.includes("Order number"));
});

test("supported cancellation tickets do not imply cancellation is already completed", async () => {
  const sampleTickets = await loadSampleTickets();
  const ticket = sampleTickets.find((entry) => entry.id === "cancellation-001");
  const { recommendation } = await analyzeWithHeuristic(ticket);
  const reply = recommendation.suggested_reply.toLowerCase();

  assert.equal(recommendation.category, "Cancellation request");
  assert.equal(recommendation.escalation_decision, "Do not escalate");
  assert.ok(reply.includes("not guaranteed"));
  assert.ok(!reply.includes("has been canceled"));
  assert.ok(!reply.includes("already canceled"));
  assert.ok(!reply.includes("we canceled"));
  assert.ok(!reply.includes("your order is canceled"));
});
