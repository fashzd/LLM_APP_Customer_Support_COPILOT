const form = document.querySelector("#ticketForm");
const sampleSelect = document.querySelector("#sampleSelect");
const loadSampleButton = document.querySelector("#loadSampleButton");
const formMessage = document.querySelector("#formMessage");
const reviewSection = document.querySelector("#reviewSection");
const historyBody = document.querySelector("#historyBody");
const ticketMetaId = document.querySelector("#ticketMetaId");
const ticketMetaCreated = document.querySelector("#ticketMetaCreated");
const reviewActionForm = document.querySelector("#reviewActionForm");
const reviewActionMessage = document.querySelector("#reviewActionMessage");
const reviewedByField = document.querySelector("#reviewedBy");
const finalDispositionField = document.querySelector("#finalDisposition");
const editedReplyField = document.querySelector("#editedReply");
const reviewNotesField = document.querySelector("#reviewNotes");
const reviewUpdatedAtField = document.querySelector("#reviewUpdatedAt");
const reviewStatusChip = document.querySelector("#reviewStatusChip");
const sampleQaStatus = document.querySelector("#sampleQaStatus");
const qaModeSelect = document.querySelector("#qaModeSelect");
const runQaButton = document.querySelector("#runQaButton");
const sampleExpectedCategory = document.querySelector("#sampleExpectedCategory");
const sampleExpectedEscalation = document.querySelector("#sampleExpectedEscalation");
const sampleNotes = document.querySelector("#sampleNotes");
const sampleComparison = document.querySelector("#sampleComparison");
const analysisNotice = document.querySelector("#analysisNotice");
const analysisNoticeText = document.querySelector("#analysisNoticeText");
const analysisNoticeMeta = document.querySelector("#analysisNoticeMeta");

const ticketFields = {
  subject: document.querySelector("#subject"),
  body: document.querySelector("#body"),
  order_id: document.querySelector("#order_id"),
  order_status: document.querySelector("#order_status"),
  customer_history: document.querySelector("#customer_history"),
  policy_snippet: document.querySelector("#policy_snippet")
};

const ticketReviewFields = {
  subject: document.querySelector("#ticketSubject"),
  body: document.querySelector("#ticketBody"),
  orderId: document.querySelector("#ticketOrderId"),
  orderStatus: document.querySelector("#ticketOrderStatus"),
  policySnippet: document.querySelector("#ticketPolicySnippet")
};

const recommendationFields = {
  category: document.querySelector("#recCategory"),
  categoryChip: document.querySelector("#recCategoryChip"),
  urgency: document.querySelector("#recUrgency"),
  urgencyChip: document.querySelector("#recUrgencyChip"),
  summary: document.querySelector("#recSummary"),
  reply: document.querySelector("#recReply"),
  policy: document.querySelector("#recPolicy"),
  missing: document.querySelector("#recMissing"),
  escalationDecision: document.querySelector("#recEscalationDecision"),
  escalationChip: document.querySelector("#recEscalationChip"),
  escalationReason: document.querySelector("#recEscalationReason")
};

let sampleTickets = [];
let regressionTickets = [];
let activeTicketId = null;
let activeSampleTicket = null;

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function setReviewActionMessage(message, isError = false) {
  reviewActionMessage.textContent = message;
  reviewActionMessage.classList.toggle("error", isError);
}

function populateSampleOptions(tickets) {
  sampleSelect.innerHTML = "";

  tickets.forEach((ticket) => {
    const option = document.createElement("option");
    option.value = ticket.id;
    option.textContent = `${ticket.id} - ${ticket.expected_category}`;
    sampleSelect.appendChild(option);
  });
}

function getActiveFixtureList() {
  return qaModeSelect.value === "regression" ? regressionTickets : sampleTickets;
}

function refreshFixtureSelect() {
  populateSampleOptions(getActiveFixtureList());
  renderSampleDetails(null);
}

function loadTicketIntoForm(ticket) {
  ticketFields.subject.value = ticket.subject || "";
  ticketFields.body.value = ticket.body || "";
  ticketFields.order_id.value = ticket.order_id || "";
  ticketFields.order_status.value = ticket.order_status || "";
  ticketFields.customer_history.value = ticket.customer_history || "";
  ticketFields.policy_snippet.value = ticket.policy_snippet || "";
  setMessage(`Loaded ${ticket.id ? `ticket ${ticket.id}` : "ticket"} into the intake form.`);
}

function applyChipState(element, label, type) {
  element.textContent = label;
  element.className = "chip";

  if (type) {
    element.classList.add(type);
  } else {
    element.classList.add("chip-neutral");
  }
}

function renderRecommendation(ticket, recommendation) {
  activeTicketId = ticket.id || null;
  ticketMetaId.textContent = ticket.id || "Unsaved";
  ticketMetaCreated.textContent = formatCreatedAt(ticket.created_at) || "Just now";
  ticketReviewFields.subject.textContent = ticket.subject || "-";
  ticketReviewFields.body.textContent = ticket.body || "-";
  ticketReviewFields.orderId.textContent = ticket.order_id || "-";
  ticketReviewFields.orderStatus.textContent = ticket.order_status || "-";
  ticketReviewFields.policySnippet.textContent = ticket.policy_snippet || "No policy snippet provided.";

  recommendationFields.category.textContent = recommendation.category;
  recommendationFields.urgency.textContent = recommendation.urgency;
  recommendationFields.summary.textContent = recommendation.customer_issue_summary;
  recommendationFields.reply.value = recommendation.suggested_reply;
  recommendationFields.policy.textContent = recommendation.policy_source_used;
  recommendationFields.escalationDecision.textContent = recommendation.escalation_decision;
  recommendationFields.escalationReason.textContent = recommendation.escalation_reason;

  applyChipState(
    recommendationFields.categoryChip,
    recommendation.category,
    recommendation.category === "Out of scope" ? "chip-dark" : "chip-blue"
  );
  applyChipState(
    recommendationFields.urgencyChip,
    `Urgency: ${recommendation.urgency}`,
    recommendation.urgency === "High"
      ? "chip-red"
      : recommendation.urgency === "Medium"
        ? "chip-amber"
        : "chip-neutral"
  );
  applyChipState(
    recommendationFields.escalationChip,
    recommendation.escalation_decision,
    recommendation.escalation_decision === "Escalate" ? "chip-red-outline" : "chip-green"
  );

  recommendationFields.missing.innerHTML = "";

  if (recommendation.missing_information.length === 0) {
    const item = document.createElement("li");
    item.textContent = "None";
    recommendationFields.missing.appendChild(item);
  } else {
    recommendation.missing_information.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      recommendationFields.missing.appendChild(item);
    });
  }

  reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAnalysisNotice(meta) {
  if (!meta) {
    analysisNotice.classList.add("hidden");
    return;
  }

  analysisNotice.classList.remove("hidden");

  if (meta.fallback?.applied) {
    analysisNotice.className = "analysis-notice notice-warning";
    analysisNoticeText.textContent = meta.fallback.reason || "A safe fallback response was used.";
    analysisNoticeMeta.textContent = `Fallback code: ${meta.fallback.code || "unknown"} | Trace ID: ${meta.fallback.trace_id || "-"}`;
    return;
  }

  analysisNotice.className = "analysis-notice notice-info";
  analysisNoticeText.textContent = "The recommendation passed validation and is ready for human review.";
  analysisNoticeMeta.textContent = `Source: ${meta.source || "unknown"} | Validation: ${meta.validation?.valid ? "passed" : "unknown"}`;
}

function renderReviewAction(reviewAction, recommendation) {
  reviewedByField.value = reviewAction?.reviewed_by || "";
  finalDispositionField.value = reviewAction?.final_disposition || "";
  editedReplyField.value = reviewAction?.edited_reply || recommendation?.suggested_reply || "";
  reviewNotesField.value = reviewAction?.notes || "";
  reviewUpdatedAtField.value = reviewAction?.updated_at
    ? `Saved ${formatCreatedAt(reviewAction.updated_at)}`
    : "No review action saved yet.";

  if (!reviewAction?.final_disposition) {
    applyChipState(reviewStatusChip, "Not reviewed", "chip-neutral");
    return;
  }

  const label = reviewAction.final_disposition.replaceAll("_", " ");
  const chipType = reviewAction.final_disposition === "escalated" ? "chip-red-outline" : "chip-green";
  applyChipState(reviewStatusChip, label, chipType);
}

function renderSampleDetails(sample) {
  activeSampleTicket = sample || null;
  sampleExpectedCategory.textContent = sample?.expected_category || "-";
  sampleExpectedEscalation.textContent = sample?.expected_escalation_decision || "-";
  sampleNotes.textContent = sample?.notes || "Load a sample ticket to view expected behavior.";
  sampleComparison.textContent = "Analyze a loaded sample to compare the result.";

  if (!sample) {
    applyChipState(sampleQaStatus, "No sample loaded", "chip-neutral");
    return;
  }

  applyChipState(sampleQaStatus, `Loaded ${sample.id}`, "chip-blue");
}

function updateSampleComparison(recommendation) {
  if (!activeSampleTicket) {
    return;
  }

  const categoryMatch = recommendation.category === activeSampleTicket.expected_category;
  const escalationMatch = recommendation.escalation_decision === activeSampleTicket.expected_escalation_decision;
  const passed = categoryMatch && escalationMatch;

  sampleComparison.textContent = passed
    ? "Pass: category and escalation matched the expected sample outcome."
    : `Check required: expected ${activeSampleTicket.expected_category} / ${activeSampleTicket.expected_escalation_decision}, received ${recommendation.category} / ${recommendation.escalation_decision}.`;

  applyChipState(sampleQaStatus, passed ? "Sample QA pass" : "Sample QA check", passed ? "chip-green" : "chip-amber");
}

function formatCreatedAt(value) {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function createHistoryRow(entry) {
  const row = document.createElement("tr");
  row.className = "history-row";

  row.innerHTML = `
    <td>${entry.ticket_id}</td>
    <td>${formatCreatedAt(entry.created_at)}</td>
    <td>${entry.category}</td>
    <td>${entry.urgency}</td>
    <td>${entry.escalation_decision}</td>
    <td>${entry.review_status ? entry.review_status.replaceAll("_", " ") : "Not reviewed"}</td>
    <td>${entry.reviewed_by || "-"}</td>
    <td><button type="button" class="secondary-button" data-ticket-id="${entry.ticket_id}">Open</button></td>
  `;

  const openButton = row.querySelector("button");
  openButton.addEventListener("click", async () => {
    setMessage(`Loading ticket ${entry.ticket_id}...`);

    try {
      const response = await fetch(`/api/history/${entry.ticket_id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load ticket history.");
      }

      loadTicketIntoForm(payload.ticket);
      renderRecommendation(payload.ticket, payload.recommendation);
      renderAnalysisNotice(payload.recommendation.meta);
      renderReviewAction(payload.review_action, payload.recommendation);
      renderSampleDetails(null);
      setMessage(`Loaded ticket ${entry.ticket_id} from history.`);
    } catch (error) {
      setMessage(error.message || "Failed to load ticket history.", true);
    }
  });

  return row;
}

function renderHistory(entries) {
  historyBody.innerHTML = "";

  if (entries.length === 0) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">No analyzed tickets yet.</td>
      </tr>
    `;
    return;
  }

  entries.forEach((entry) => {
    historyBody.appendChild(createHistoryRow(entry));
  });
}

async function loadSamples() {
  const response = await fetch("/api/sample-tickets");
  if (!response.ok) {
    throw new Error("Failed to load sample tickets.");
  }

  sampleTickets = await response.json();
}

async function loadRegressionTickets() {
  const response = await fetch("/api/regression-tickets");

  if (!response.ok) {
    throw new Error("Failed to load regression tickets.");
  }

  regressionTickets = await response.json();
}

async function loadHistory() {
  const response = await fetch("/api/history");

  if (!response.ok) {
    throw new Error("Failed to load review history.");
  }

  const entries = await response.json();
  renderHistory(entries);
}

loadSampleButton.addEventListener("click", () => {
  const selected = getActiveFixtureList().find((ticket) => ticket.id === sampleSelect.value);

  if (!selected) {
    setMessage("No sample ticket selected.", true);
    return;
  }

  loadTicketIntoForm(selected);
  renderSampleDetails(selected);
  renderReviewAction(null, null);
});

qaModeSelect.addEventListener("change", () => {
  refreshFixtureSelect();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Analyzing ticket...");

  const ticket = {
    subject: ticketFields.subject.value,
    body: ticketFields.body.value,
    order_id: ticketFields.order_id.value,
    order_status: ticketFields.order_status.value,
    customer_history: ticketFields.customer_history.value,
    policy_snippet: ticketFields.policy_snippet.value
  };

  try {
    const response = await fetch("/api/tickets/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(ticket)
    });

    const payload = await response.json();

    if (!response.ok) {
      const detailMessage = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
      throw new Error((payload.error || "Analysis failed.") + detailMessage);
    }

    renderRecommendation(payload.ticket, payload.recommendation);
    renderAnalysisNotice(payload.meta);
    renderReviewAction(null, payload.recommendation);
    updateSampleComparison(payload.recommendation);
    await loadHistory();
    setMessage("Analysis complete.");
  } catch (error) {
    setMessage(error.message || "Analysis failed.", true);
  }
});

reviewActionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeTicketId) {
    setReviewActionMessage("Analyze or open a ticket before saving a review action.", true);
    return;
  }

  setReviewActionMessage("Saving review action...");

  try {
    const response = await fetch(`/api/tickets/${activeTicketId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reviewed_by: reviewedByField.value,
        final_disposition: finalDispositionField.value,
        edited_reply: editedReplyField.value,
        notes: reviewNotesField.value
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      const detailMessage = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
      throw new Error((payload.error || "Failed to save review action.") + detailMessage);
    }

    renderReviewAction(payload.review_action);
    await loadHistory();
    setReviewActionMessage("Review action saved.");
  } catch (error) {
    setReviewActionMessage(error.message || "Failed to save review action.", true);
  }
});

runQaButton.addEventListener("click", async () => {
  if (!activeSampleTicket) {
    setMessage("Load a sample or regression ticket before running a QA check.", true);
    return;
  }

  setMessage(`Running QA check for ${activeSampleTicket.id}...`);

  try {
    const response = await fetch("/api/tickets/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: activeSampleTicket.subject,
        body: activeSampleTicket.body,
        order_id: activeSampleTicket.order_id,
        order_status: activeSampleTicket.order_status,
        customer_history: activeSampleTicket.customer_history,
        policy_snippet: activeSampleTicket.policy_snippet
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "QA check failed.");
    }

    renderRecommendation(payload.ticket, payload.recommendation);
    renderAnalysisNotice(payload.meta);
    renderReviewAction(null, payload.recommendation);
    updateSampleComparison(payload.recommendation);
    await loadHistory();
    setMessage(`QA check complete for ${activeSampleTicket.id}.`);
  } catch (error) {
    setMessage(error.message || "QA check failed.", true);
  }
});

Promise.all([loadSamples(), loadRegressionTickets(), loadHistory()]).then(() => {
  refreshFixtureSelect();
}).catch((error) => {
  setMessage(error.message || "Failed to load initial data.", true);
});
