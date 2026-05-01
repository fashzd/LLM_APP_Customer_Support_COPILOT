import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTicket } from "../server/analyzer.js";
import { createStorage } from "../server/storage.js";
import { validateAndNormalizeTicketInput, validateReviewActionInput } from "../server/ticketInput.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const schemaPath = path.join(rootDir, "AI_OUTPUT_SCHEMA.json");
const promptSpecPath = path.join(rootDir, "PROMPT_SPEC.md");

test("ticket input validation rejects missing body, non-string fields, and oversized fields", () => {
  const result = validateAndNormalizeTicketInput({
    subject: "A".repeat(201),
    body: null,
    order_id: 123
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Ticket fields must be strings."));
  assert.ok(result.errors.includes("subject must be 200 characters or fewer."));
  assert.ok(result.errors.includes("Ticket body is required."));
});

test("review action validation enforces allowed dispositions", () => {
  const invalid = validateReviewActionInput({
    reviewed_by: "Agent A",
    final_disposition: "done",
    edited_reply: "ok",
    notes: "note"
  });
  const valid = validateReviewActionInput({
    reviewed_by: "Agent B",
    final_disposition: "edited_and_used",
    edited_reply: "Updated reply",
    notes: "Saved by a reviewer"
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors[0].includes("final_disposition must be one of"));
  assert.equal(valid.valid, true);
  assert.equal(valid.reviewAction.reviewed_by, "Agent B");
  assert.equal(valid.reviewAction.final_disposition, "edited_and_used");
});

test("successful analysis includes explicit non-fallback metadata", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await analyzeTicket({
      ticket: {
        subject: "Please cancel before it ships",
        body: "I placed order ORD-2005 this morning by mistake. Please cancel it before it goes out.",
        order_id: "ORD-2005",
        order_status: "Processing",
        customer_history: "",
        policy_snippet: ""
      },
      schemaPath,
      promptSpecPath
    });

    assert.equal(result.meta.validation.valid, true);
    assert.equal(result.meta.fallback.applied, false);
    assert.equal(result.meta.fallback.code, null);
    assert.equal(result.meta.fallback.trace_id, null);
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("fallback metadata is traceable when invalid model output is replaced", async () => {
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
    const result = await analyzeTicket({
      ticket: {
        subject: "Need help",
        body: "Please help with my return",
        order_id: "",
        order_status: "",
        customer_history: "",
        policy_snippet: ""
      },
      schemaPath,
      promptSpecPath
    });

    assert.equal(result.meta.fallback.applied, true);
    assert.equal(result.meta.fallback.code, "schema_validation_failed");
    assert.ok(result.meta.fallback.trace_id.startsWith("fb-"));
    assert.ok(result.meta.fallback.reason.includes("did not pass schema validation"));
  } finally {
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    global.fetch = originalFetch;
  }
});

test("storage persists and reloads final review actions", async () => {
  const dbPath = path.join(rootDir, "tmp-phase3-review-test.db");
  const storage = createStorage({ dbPath });
  const saved = storage.saveAnalysis(
    {
      subject: "History check",
      body: "Please cancel my order",
      order_id: "ORD-1",
      order_status: "Processing",
      customer_history: "",
      policy_snippet: "Cancellation requests can be reviewed before shipment."
    },
    {
      recommendation: {
        category: "Cancellation request",
        urgency: "High",
        customer_issue_summary: "Customer wants to cancel the order.",
        suggested_reply:
          "Thanks for reaching out. I can help review your cancellation request, though cancellation is not guaranteed once fulfillment has begun.",
        policy_source_used: "Cancellation requests can be reviewed before shipment.",
        missing_information: [],
        escalation_decision: "Do not escalate",
        escalation_reason: "This appears to be a standard supported request that the frontline agent can review."
      },
      meta: {
        source: "heuristic",
        validation: {
          valid: true,
          errors: []
        },
        fallback: {
          applied: false,
          code: null,
          reason: null,
          trace_id: null
        }
      }
    }
  );

  const reviewAction = storage.saveReviewAction(saved.ticket.id, {
    reviewed_by: "A. Patel",
    final_disposition: "edited_and_used",
    edited_reply: "Manual final draft",
    notes: "Agent reviewed the case."
  });
  const reopened = storage.getAnalysis(saved.ticket.id);
  const history = storage.getHistory();

  assert.equal(reviewAction.final_disposition, "edited_and_used");
  assert.equal(reviewAction.reviewed_by, "A. Patel");
  assert.equal(reopened.review_action.final_disposition, "edited_and_used");
  assert.equal(reopened.review_action.reviewed_by, "A. Patel");
  assert.equal(reopened.review_action.edited_reply, "Manual final draft");
  assert.equal(history[0].review_status, "edited_and_used");

  if (existsSync(dbPath)) {
    await unlink(dbPath);
  }
});
