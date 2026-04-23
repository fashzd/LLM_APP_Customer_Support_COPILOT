const form = document.querySelector("#ticketForm");
const sampleSelect = document.querySelector("#sampleSelect");
const loadSampleButton = document.querySelector("#loadSampleButton");
const formMessage = document.querySelector("#formMessage");
const reviewSection = document.querySelector("#reviewSection");
const historyBody = document.querySelector("#historyBody");
const ticketMetaId = document.querySelector("#ticketMetaId");
const ticketMetaCreated = document.querySelector("#ticketMetaCreated");

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
  orderStatus: document.querySelector("#ticketOrderStatus")
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

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
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

function loadTicketIntoForm(ticket) {
  ticketFields.subject.value = ticket.subject || "";
  ticketFields.body.value = ticket.body || "";
  ticketFields.order_id.value = ticket.order_id || "";
  ticketFields.order_status.value = ticket.order_status || "";
  ticketFields.customer_history.value = ticket.customer_history || "";
  ticketFields.policy_snippet.value = ticket.policy_snippet || "";
  setMessage(`Loaded sample ticket: ${ticket.id}`);
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
  ticketMetaId.textContent = ticket.id || "Unsaved";
  ticketMetaCreated.textContent = formatCreatedAt(ticket.created_at) || "Just now";
  ticketReviewFields.subject.textContent = ticket.subject || "-";
  ticketReviewFields.body.textContent = ticket.body || "-";
  ticketReviewFields.orderId.textContent = ticket.order_id || "-";
  ticketReviewFields.orderStatus.textContent = ticket.order_status || "-";

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
        <td colspan="6" class="empty-state">No analyzed tickets yet.</td>
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
  populateSampleOptions(sampleTickets);
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
  const selected = sampleTickets.find((ticket) => ticket.id === sampleSelect.value);

  if (!selected) {
    setMessage("No sample ticket selected.", true);
    return;
  }

  loadTicketIntoForm(selected);
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
      throw new Error(payload.error || "Analysis failed.");
    }

    renderRecommendation(payload.ticket, payload.recommendation);
    await loadHistory();
    setMessage("Analysis complete.");
  } catch (error) {
    setMessage(error.message || "Analysis failed.", true);
  }
});

Promise.all([loadSamples(), loadHistory()]).catch((error) => {
  setMessage(error.message || "Failed to load initial data.", true);
});
