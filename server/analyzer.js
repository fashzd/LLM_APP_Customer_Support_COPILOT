import { readFile } from "node:fs/promises";
import {
  buildOutOfScopeReply,
  buildSafeFallback,
  getOutOfScopeMissingInformation,
  normalizeOutOfScope
} from "./fallback.js";
import { loadPromptSpec } from "./promptLoader.js";
import { isValidAgainstSchema, toOpenAISchema } from "./schemaValidator.js";

const FALLBACK_POLICY = "No matching store policy provided; based on supported ticket handling rules";

function formatTicketInput(ticket) {
  return {
    ticket: {
      subject: ticket.subject || "",
      body: ticket.body || "",
      order_id: ticket.order_id || "",
      order_status: ticket.order_status || "",
      customer_history: ticket.customer_history || "",
      policy_snippet: ticket.policy_snippet || ""
    },
    allowed_categories: [
      "Return request",
      "Refund request",
      "Damaged item",
      "Shipping delay / missing order",
      "Cancellation request",
      "Out of scope"
    ],
    urgency_levels: ["Low", "Medium", "High"],
    escalation_values: ["Escalate", "Do not escalate"],
    rules: {
      human_review_only: true,
      never_auto_send: true,
      never_auto_approve_refunds: true,
      never_make_account_changes: true,
      mark_unsupported_as_out_of_scope: true
    }
  };
}

function extractRiskSignals(text) {
  const lowered = text.toLowerCase();

  return {
    legalRisk: /\b(chargeback|lawyer|attorney|legal|bank|complaint|regulator|fraud)\b/.test(lowered),
    repeatContact: /\b(second time|third time|again|still no response|twice|multiple times)\b/.test(lowered),
    policyException: /\b(exception|make an exception|outside policy)\b/.test(lowered)
  };
}

function buildMissingInfo(ticket, category) {
  if (category === "Out of scope") {
    return getOutOfScopeMissingInformation(ticket);
  }

  const missing = [];
  const body = `${ticket.subject || ""} ${ticket.body || ""}`.toLowerCase();

  if (!ticket.order_id) {
    missing.push("Order number");
  }

  if (category === "Damaged item" && !/\b(photo|picture|images)\b/.test(body)) {
    missing.push("Photos of the damaged item");
  }

  if (category === "Shipping delay / missing order" && !/\baddress\b/.test(body)) {
    missing.push("Shipping address confirmation");
  }

  if (category === "Refund request" && !/\bkept|returned|returning\b/.test(body)) {
    missing.push("Whether the item was kept or returned");
  }

  if (category === "Cancellation request" && !ticket.order_status) {
    missing.push("Current fulfillment or shipment status");
  }

  return missing;
}

function deriveIntentSignals(ticket) {
  const text = `${ticket.subject || ""} ${ticket.body || ""}`.toLowerCase();

  return {
    mentionsReturn: /\breturn|send it back|exchange|different size\b/.test(text),
    mentionsRefund: /\brefund|money back|credit back|charged\b/.test(text),
    mentionsDamage: /\bbroken|damaged|shattered|defect|defective\b/.test(text),
    mentionsCancellation: /\bcancel|stop this order\b/.test(text),
    mentionsShipping: /\bwhere is my order|missing order|never received|not received|tracking|delivered|in transit|late\b/.test(text),
    explicitMixedIntent: /\b(return it or get a refund|return or refund|refund or return)\b/.test(text),
    deliveryIssueRefund: /\b(late|delayed).*(refund|money back)|(refund|money back).*(late|delayed)\b/.test(text),
    returnOnlyLanguage: /\btoo small|too big|does not fit|wrong size|exchange\b/.test(text)
  };
}

function detectCategory(ticket) {
  const text = `${ticket.subject || ""} ${ticket.body || ""}`.toLowerCase();
  const intent = deriveIntentSignals(ticket);

  if (/\b(password|log in|login|account|email address)\b/.test(text)) {
    return "Out of scope";
  }

  if (/\bdouble charge|charged twice|billing\b/.test(text)) {
    return "Out of scope";
  }

  if (intent.explicitMixedIntent) {
    return "Out of scope";
  }

  if (intent.mentionsCancellation) {
    return "Cancellation request";
  }

  if (intent.mentionsRefund && intent.deliveryIssueRefund) {
    return "Refund request";
  }

  if (intent.mentionsReturn && intent.mentionsRefund) {
    return "Out of scope";
  }

  if (intent.mentionsReturn || intent.returnOnlyLanguage) {
    return "Return request";
  }

  if (intent.mentionsRefund) {
    return "Refund request";
  }

  if (intent.mentionsDamage) {
    return "Damaged item";
  }

  if (intent.mentionsShipping) {
    return "Shipping delay / missing order";
  }

  return "Out of scope";
}

function detectUrgency(ticket, category, riskSignals) {
  const text = `${ticket.subject || ""} ${ticket.body || ""}`.toLowerCase();

  if (riskSignals.legalRisk) {
    return "High";
  }

  if (category === "Cancellation request") {
    return "High";
  }

  if (category === "Damaged item" && /\bshattered|unsafe|hazard|dangerous\b/.test(text)) {
    return "High";
  }

  if (/\burgent|asap|immediately|today\b/.test(text)) {
    return "High";
  }

  if (category === "Shipping delay / missing order" && /\bdelivered|missing|never received\b/.test(text)) {
    return "High";
  }

  return "Medium";
}

function buildSuggestedReply(ticket, category, missingInformation) {
  const asks = missingInformation.length
    ? ` Please share ${missingInformation.join(" and ").toLowerCase()} so our team can review the next steps.`
    : "";

  if (category === "Out of scope") {
    return buildOutOfScopeReply(ticket, missingInformation);
  }

  const openings = {
    "Return request": "Thanks for reaching out. I can help review your return request.",
    "Refund request": "Thanks for reaching out, and I'm sorry for the frustration. I can help review your refund request.",
    "Damaged item": "Thanks for reaching out, and I'm sorry your item arrived damaged. I can help review the issue.",
    "Shipping delay / missing order":
      "Thanks for reaching out, and I'm sorry you're dealing with this delivery issue. I can help review the missing order concern.",
    "Cancellation request":
      "Thanks for reaching out. I can help review your cancellation request, though cancellation is not guaranteed once fulfillment has begun."
  };

  return `${openings[category]}${asks}`;
}

function heuristicAnalyze(ticket) {
  const combined = `${ticket.subject || ""} ${ticket.body || ""} ${ticket.customer_history || ""}`;
  const riskSignals = extractRiskSignals(combined);
  const category = detectCategory(ticket);
  const urgency = detectUrgency(ticket, category, riskSignals);
  const missingInformation = buildMissingInfo(ticket, category);
  const escalationDecision =
    category === "Out of scope" || riskSignals.legalRisk || riskSignals.policyException ? "Escalate" : "Do not escalate";
  const escalationReason =
    category === "Out of scope"
      ? "This ticket is outside the five supported categories and requires manual review."
      : escalationDecision === "Escalate"
        ? "The ticket contains risk signals or may require a policy exception."
        : "This appears to be a standard supported request that the frontline agent can review."
  ;

  const summaryText =
    ticket.body?.trim() ||
    ticket.subject?.trim() ||
    "The customer submitted a support request that needs review.";

  const recommendation = {
    category,
    urgency,
    customer_issue_summary: summaryText.slice(0, 280),
    suggested_reply: buildSuggestedReply(ticket, category, missingInformation),
    policy_source_used: ticket.policy_snippet?.trim() || FALLBACK_POLICY,
    missing_information: missingInformation,
    escalation_decision: escalationDecision,
    escalation_reason: escalationReason
  };

  if (category === "Out of scope") {
    return normalizeOutOfScope(recommendation, escalationReason);
  }

  return recommendation;
}

function extractResponseText(apiResponse) {
  if (typeof apiResponse.output_text === "string" && apiResponse.output_text.trim()) {
    return apiResponse.output_text;
  }

  const outputs = Array.isArray(apiResponse.output) ? apiResponse.output : [];

  for (const output of outputs) {
    if (output.type !== "message" || !Array.isArray(output.content)) {
      continue;
    }

    for (const contentItem of output.content) {
      if (contentItem.type === "refusal") {
        throw new Error(contentItem.refusal || "The model refused to process the ticket.");
      }

      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text;
      }

      if (contentItem.type === "output_text" && typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text;
      }
    }
  }

  throw new Error("No text output was returned by the model.");
}

async function analyzeWithOpenAI(ticket, schemaPath, promptSpecPath) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const [schemaRaw, promptSpec] = await Promise.all([
    readFile(schemaPath, "utf8"),
    loadPromptSpec(promptSpecPath)
  ]);

  const schema = JSON.parse(schemaRaw);
  const inputPayload = formatTicketInput(ticket);
  const taskPrompt = promptSpec.taskPromptTemplate.replace("{{ticket_input_json}}", JSON.stringify(inputPayload, null, 2));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: promptSpec.systemPrompt
        },
        {
          role: "user",
          content: taskPrompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "customer_support_copilot_output",
          strict: true,
          schema: toOpenAISchema(schema)
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const apiResponse = await response.json();
  const responseText = extractResponseText(apiResponse);

  return JSON.parse(responseText);
}

function postProcessRecommendation(recommendation, ticket) {
  const text = `${ticket.subject || ""} ${ticket.body || ""} ${ticket.customer_history || ""}`.toLowerCase();

  if (recommendation.category === "Out of scope") {
    return normalizeOutOfScope(
      recommendation,
      recommendation.escalation_reason || "This ticket is outside the supported categories."
    );
  }

  if (/\b(chargeback|attorney|legal|fraud|bank|complaint)\b/.test(text)) {
    return {
      ...recommendation,
      escalation_decision: "Escalate",
      escalation_reason: "The ticket contains legal, fraud, or financial risk signals."
    };
  }

  return recommendation;
}

function buildFallbackMeta(code, reason, validation = { valid: false, errors: [] }) {
  return {
    source: process.env.OPENAI_API_KEY ? "openai-or-fallback" : "heuristic",
    validation,
    fallback: {
      applied: true,
      code,
      reason,
      trace_id: `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }
  };
}

export async function analyzeTicket({ ticket, schemaPath, promptSpecPath }) {
  let candidate;
  let source = process.env.OPENAI_API_KEY ? "openai-or-fallback" : "heuristic";

  try {
    candidate = await analyzeWithOpenAI(ticket, schemaPath, promptSpecPath);
  } catch (error) {
    candidate = heuristicAnalyze(ticket);
    source = "heuristic";
  }

  if (!candidate) {
    candidate = heuristicAnalyze(ticket);
    source = "heuristic";
  }

  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const normalized = postProcessRecommendation(candidate, ticket);
  const validation = isValidAgainstSchema(schema, normalized);

  if (!validation.valid) {
    const reason = `The generated output did not pass schema validation: ${validation.errors.join("; ")}`;

    return {
      recommendation: buildSafeFallback(ticket, reason),
      meta: buildFallbackMeta("schema_validation_failed", reason, validation)
    };
  }

  const unsafeReply = normalized.suggested_reply.toLowerCase();

  if (
    unsafeReply.includes("has been canceled") ||
    unsafeReply.includes("already canceled") ||
    unsafeReply.includes("your order is canceled") ||
    unsafeReply.includes("refund has been issued") ||
    unsafeReply.includes("we already refunded")
  ) {
    const reason = "The generated output used unsafe action-complete wording and was replaced with a safe fallback.";

    return {
      recommendation: buildSafeFallback(ticket, reason),
      meta: buildFallbackMeta("unsafe_wording_detected", reason, validation)
    };
  }

  return {
    recommendation: normalized,
    meta: {
      source,
      validation,
      fallback: {
        applied: false,
        code: null,
        reason: null,
        trace_id: null
      }
    }
  };
}
