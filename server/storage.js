import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createStorage({ dbPath }) {
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      order_id TEXT NOT NULL DEFAULT '',
      order_status TEXT NOT NULL DEFAULT '',
      customer_history TEXT NOT NULL DEFAULT '',
      policy_snippet TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      urgency TEXT NOT NULL,
      customer_issue_summary TEXT NOT NULL,
      suggested_reply TEXT NOT NULL,
      policy_source_used TEXT NOT NULL,
      missing_information_json TEXT NOT NULL,
      escalation_decision TEXT NOT NULL,
      escalation_reason TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'heuristic',
      validation_valid INTEGER NOT NULL DEFAULT 0,
      validation_errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets (id)
    );
  `);

  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      subject,
      body,
      order_id,
      order_status,
      customer_history,
      policy_snippet
    ) VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id, subject, body, order_id, order_status, customer_history, policy_snippet, created_at
  `);

  const insertRecommendation = db.prepare(`
    INSERT INTO recommendations (
      ticket_id,
      category,
      urgency,
      customer_issue_summary,
      suggested_reply,
      policy_source_used,
      missing_information_json,
      escalation_decision,
      escalation_reason,
      source,
      validation_valid,
      validation_errors_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING
      id,
      ticket_id,
      category,
      urgency,
      customer_issue_summary,
      suggested_reply,
      policy_source_used,
      missing_information_json,
      escalation_decision,
      escalation_reason,
      source,
      validation_valid,
      validation_errors_json,
      created_at
  `);

  const listHistory = db.prepare(`
    SELECT
      tickets.id AS ticket_id,
      tickets.created_at AS created_at,
      recommendations.category AS category,
      recommendations.urgency AS urgency,
      recommendations.escalation_decision AS escalation_decision
    FROM tickets
    INNER JOIN recommendations ON recommendations.ticket_id = tickets.id
    ORDER BY tickets.id DESC
  `);

  const getTicketDetail = db.prepare(`
    SELECT
      tickets.id AS ticket_id,
      tickets.subject AS subject,
      tickets.body AS body,
      tickets.order_id AS order_id,
      tickets.order_status AS order_status,
      tickets.customer_history AS customer_history,
      tickets.policy_snippet AS policy_snippet,
      tickets.created_at AS ticket_created_at,
      recommendations.id AS recommendation_id,
      recommendations.category AS category,
      recommendations.urgency AS urgency,
      recommendations.customer_issue_summary AS customer_issue_summary,
      recommendations.suggested_reply AS suggested_reply,
      recommendations.policy_source_used AS policy_source_used,
      recommendations.missing_information_json AS missing_information_json,
      recommendations.escalation_decision AS escalation_decision,
      recommendations.escalation_reason AS escalation_reason,
      recommendations.source AS source,
      recommendations.validation_valid AS validation_valid,
      recommendations.validation_errors_json AS validation_errors_json,
      recommendations.created_at AS recommendation_created_at
    FROM tickets
    INNER JOIN recommendations ON recommendations.ticket_id = tickets.id
    WHERE tickets.id = ?
  `);

  function parseRecommendationRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.recommendation_id ?? row.id,
      ticket_id: row.ticket_id,
      category: row.category,
      urgency: row.urgency,
      customer_issue_summary: row.customer_issue_summary,
      suggested_reply: row.suggested_reply,
      policy_source_used: row.policy_source_used,
      missing_information: JSON.parse(row.missing_information_json),
      escalation_decision: row.escalation_decision,
      escalation_reason: row.escalation_reason,
      created_at: row.recommendation_created_at ?? row.created_at,
      meta: {
        source: row.source,
        validation: {
          valid: Boolean(row.validation_valid),
          errors: JSON.parse(row.validation_errors_json)
        }
      }
    };
  }

  function saveAnalysis(ticket, analysis) {
    const savedTicket = insertTicket.get(
      ticket.subject || "",
      ticket.body,
      ticket.order_id || "",
      ticket.order_status || "",
      ticket.customer_history || "",
      ticket.policy_snippet || ""
    );

    const savedRecommendation = insertRecommendation.get(
      savedTicket.id,
      analysis.recommendation.category,
      analysis.recommendation.urgency,
      analysis.recommendation.customer_issue_summary,
      analysis.recommendation.suggested_reply,
      analysis.recommendation.policy_source_used,
      JSON.stringify(analysis.recommendation.missing_information),
      analysis.recommendation.escalation_decision,
      analysis.recommendation.escalation_reason,
      analysis.meta.source,
      analysis.meta.validation.valid ? 1 : 0,
      JSON.stringify(analysis.meta.validation.errors)
    );

    return {
      ticket: savedTicket,
      recommendation: parseRecommendationRow(savedRecommendation)
    };
  }

  function getHistory() {
    return listHistory.all().map((row) => ({
      ticket_id: row.ticket_id,
      created_at: row.created_at,
      category: row.category,
      urgency: row.urgency,
      escalation_decision: row.escalation_decision
    }));
  }

  function getAnalysis(ticketId) {
    const row = getTicketDetail.get(ticketId);

    if (!row) {
      return null;
    }

    return {
      ticket: {
        id: row.ticket_id,
        subject: row.subject,
        body: row.body,
        order_id: row.order_id,
        order_status: row.order_status,
        customer_history: row.customer_history,
        policy_snippet: row.policy_snippet,
        created_at: row.ticket_created_at
      },
      recommendation: parseRecommendationRow(row)
    };
  }

  return {
    saveAnalysis,
    getHistory,
    getAnalysis
  };
}
