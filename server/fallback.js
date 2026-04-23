const OUT_OF_SCOPE_REPLY =
  "Thanks for reaching out. Your request needs manual review by our support team so we can make sure it is handled correctly. A team member will review the details and follow up with the right next steps.";

function detectOutOfScopeContext(ticket) {
  const text = `${ticket.subject || ""} ${ticket.body || ""} ${ticket.customer_history || ""}`.toLowerCase();

  if (/\b(password|log in|login|account access|locked out|security)\b/.test(text)) {
    return "account_access";
  }

  if (/\b(email address|change the email|update the email)\b/.test(text)) {
    return "account_change";
  }

  if (/\b(double charge|charged twice|billing|chargeback|bank)\b/.test(text)) {
    return "billing_dispute";
  }

  return "generic";
}

export function getOutOfScopeMissingInformation(ticket) {
  const context = detectOutOfScopeContext(ticket);

  if (context === "account_access") {
    return [
      "Account email address",
      "Safe verification details required by the support team"
    ];
  }

  if (context === "account_change") {
    return [
      "Current account email address",
      "Requested new email address",
      "Safe verification details required by the support team"
    ];
  }

  if (context === "billing_dispute") {
    return [
      "Transaction or order reference",
      "The date and amount of the disputed charge",
      "Any bank or chargeback reference details"
    ];
  }

  return [];
}

export function buildOutOfScopeReply(ticket, missingInformation = []) {
  if (missingInformation.length === 0) {
    return OUT_OF_SCOPE_REPLY;
  }

  const requestDetails = missingInformation.join(" and ").toLowerCase();

  return `${OUT_OF_SCOPE_REPLY} If available, please share ${requestDetails} so the team can review the case safely.`;
}

export function buildSafeFallback(ticket, reason = "The automated analysis could not produce a safe validated result.") {
  const summarySubject = ticket.subject?.trim();
  const summaryBody = ticket.body?.trim();
  const summarySource = summarySubject || summaryBody || "The customer submitted a support request.";
  const missingInformation = getOutOfScopeMissingInformation(ticket);

  return {
    category: "Out of scope",
    urgency: "Medium",
    customer_issue_summary: `Manual review is required because the ticket could not be safely analyzed. Ticket context: ${summarySource}`.slice(
      0,
      320
    ),
    suggested_reply: buildOutOfScopeReply(ticket, missingInformation),
    policy_source_used: "Safe fallback response based on supported ticket handling rules",
    missing_information: missingInformation,
    escalation_decision: "Escalate",
    escalation_reason: reason
  };
}

export function normalizeOutOfScope(recommendation, reason) {
  return {
    ...recommendation,
    category: "Out of scope",
    escalation_decision: "Escalate",
    escalation_reason: reason || recommendation.escalation_reason || "This ticket is outside the supported categories."
  };
}
