const MAX_FIELD_LENGTHS = {
  subject: 200,
  body: 5000,
  order_id: 100,
  order_status: 100,
  customer_history: 2000,
  policy_snippet: 2000
};

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error("Ticket fields must be strings.");
  }

  return value.trim();
}

function enforceLength(field, value, errors) {
  const maxLength = MAX_FIELD_LENGTHS[field];

  if (value.length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or fewer.`);
  }
}

export function validateAndNormalizeTicketInput(rawInput) {
  const errors = [];
  const ticket = {};

  for (const field of Object.keys(MAX_FIELD_LENGTHS)) {
    let normalized = "";

    try {
      normalized = normalizeText(rawInput[field]);
    } catch (error) {
      errors.push(error.message);
      normalized = "";
    }

    enforceLength(field, normalized, errors);
    ticket[field] = normalized;
  }

  if (!ticket.body) {
    errors.push("Ticket body is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    ticket
  };
}

export function validateReviewActionInput(rawInput) {
  const allowedDispositions = [
    "used_as_draft",
    "edited_and_used",
    "requested_more_info",
    "escalated",
    "discarded"
  ];

  const disposition = normalizeText(rawInput.final_disposition);
  const editedReply = normalizeText(rawInput.edited_reply);
  const notes = normalizeText(rawInput.notes);
  const reviewedBy = normalizeText(rawInput.reviewed_by);
  const errors = [];

  if (!allowedDispositions.includes(disposition)) {
    errors.push(`final_disposition must be one of: ${allowedDispositions.join(", ")}`);
  }

  if (editedReply.length > 5000) {
    errors.push("edited_reply must be 5000 characters or fewer.");
  }

  if (notes.length > 2000) {
    errors.push("notes must be 2000 characters or fewer.");
  }

  if (!reviewedBy) {
    errors.push("reviewed_by is required.");
  }

  if (reviewedBy.length > 120) {
    errors.push("reviewed_by must be 120 characters or fewer.");
  }

  return {
    valid: errors.length === 0,
    errors,
    reviewAction: {
      final_disposition: disposition,
      edited_reply: editedReply,
      notes,
      reviewed_by: reviewedBy
    }
  };
}
