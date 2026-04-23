# Customer Support Copilot V1 Implementation Plan

## 1. Goal

Build the smallest useful V1 of the Customer Support Copilot: a human-in-the-loop internal tool where a support agent pastes or loads a single ticket and receives a structured AI recommendation that is safe, reviewable, and limited to five supported categories.

This plan is intentionally narrow. It prioritizes:
- Safe recommendations over automation
- Clear structure over feature breadth
- Fast path to a usable internal tool

## 2. Recommended V1 Architecture

### High-level shape
Use a simple three-layer app:

1. Frontend agent workspace
2. Backend application API
3. AI orchestration layer with rule-based safeguards

### Recommended stack
For V1, choose a standard web app stack that is fast to build and easy to maintain:
- Frontend: React with a simple component-based UI
- Backend: Node.js service with REST endpoints
- Persistence: SQLite for local/dev and early internal demos
- AI integration: single model call with strict JSON output validation

This keeps the system small while still giving us clean separation between UI, business rules, and AI behavior.

### Suggested service boundaries

#### Frontend
Responsibilities:
- Ticket input form
- Ticket review screen
- Render structured AI output
- Show clear human-review status
- Allow agent edits to suggested reply before copy/use

#### Backend API
Responsibilities:
- Accept ticket input
- Normalize input into an internal ticket shape
- Build AI prompt input
- Call model
- Validate and sanitize AI output
- Apply deterministic escalation and out-of-scope guardrails
- Store ticket + recommendation + review metadata

#### AI orchestration module
Responsibilities:
- Prepare system prompt and structured task prompt
- Insert policy snippets if available
- Enforce supported category list
- Parse JSON output
- Fall back safely if the model returns invalid or risky output

### Why this architecture fits V1
- It supports one-ticket-at-a-time workflows cleanly
- It keeps critical safety logic outside the model
- It is easy to demo and test with fixture tickets
- It can evolve later into helpdesk or ecommerce integrations without rewriting core logic

## 3. Main Screens

### 3.1 Ticket Intake Screen
Purpose:
- Let an agent submit a single customer ticket for analysis

Fields:
- Ticket subject
- Ticket body
- Optional order ID
- Optional order status
- Optional prior message history
- Optional policy snippet

Primary actions:
- `Analyze ticket`
- `Load sample ticket` for testing

### 3.2 Recommendation Review Screen
Purpose:
- Show the original ticket and the AI recommendation side by side

Displayed sections:
- Category
- Urgency
- Customer issue summary
- Suggested reply
- Policy/source used
- Missing information
- Escalation decision
- Escalation reason

Supporting UI:
- Badge: `Needs human review`
- Copy suggested reply button
- Edit reply text area
- Mark as escalated / not escalated
- Save review outcome

### 3.3 Review History Screen
Purpose:
- Allow internal users to revisit prior ticket analyses

Displayed columns:
- Ticket ID
- Submitted time
- Category
- Urgency
- Escalation decision
- Review status

V1 note:
This can be very simple. Even a basic table is enough.

## 4. User Flow

### Primary happy path
1. Agent opens the Ticket Intake screen.
2. Agent pastes the customer ticket and optional context.
3. Agent clicks `Analyze ticket`.
4. Backend validates the request and sends a structured prompt to the model.
5. Backend validates the model output against the required schema.
6. Backend applies safety checks:
   - unsupported category correction
   - invalid escalation correction
   - forbidden wording checks
7. Agent sees the Recommendation Review screen.
8. Agent reviews the summary, suggested reply, missing information, and escalation recommendation.
9. Agent edits the reply if needed.
10. Agent decides whether to use the draft, gather more information, or escalate the case outside the tool.

### Out-of-scope path
1. Agent submits a ticket outside the supported categories.
2. Model or backend labels the ticket `Out of scope`.
3. Review screen shows:
   - Category: `Out of scope`
   - Suggested reply that politely says the issue needs manual review
   - Escalation decision: `Escalate`
   - Escalation reason explaining the unsupported issue type

### Failure-safe path
1. Model returns malformed JSON or unsafe output.
2. Backend does not pass raw output through.
3. Backend returns a safe fallback recommendation:
   - Category: `Out of scope`
   - Urgency: `Medium`
   - Suggested reply requesting human follow-up
   - Escalation decision: `Escalate`
   - Escalation reason describing AI validation failure

## 5. Data Model

Use a small relational model. This is enough for V1 and easy to extend later.

### 5.1 Ticket

Fields:
- `id`
- `subject`
- `body`
- `order_id`
- `order_status`
- `customer_history`
- `policy_snippet`
- `created_at`

Purpose:
- Stores the raw support case input submitted by an agent

### 5.2 Recommendation

Fields:
- `id`
- `ticket_id`
- `category`
- `urgency`
- `customer_issue_summary`
- `suggested_reply`
- `policy_source_used`
- `missing_information_json`
- `escalation_decision`
- `escalation_reason`
- `raw_model_output_json`
- `validation_status`
- `created_at`

Purpose:
- Stores the normalized AI output plus raw response for debugging

### 5.3 ReviewAction

Fields:
- `id`
- `ticket_id`
- `recommendation_id`
- `reviewed_by`
- `edited_reply`
- `final_disposition`
- `notes`
- `created_at`

Suggested `final_disposition` values:
- `used_as_draft`
- `edited_and_used`
- `requested_more_info`
- `escalated`
- `discarded`

### 5.4 Optional Policy table

Fields:
- `id`
- `name`
- `category`
- `content`
- `active`
- `created_at`

Purpose:
- Enables V1.5 or V2 retrieval of internal policy snippets without changing the rest of the app

For the earliest V1, this can be skipped and replaced by manually supplied policy snippets.

## 6. AI Input Contract

The backend should send a structured request object to the AI layer, not free-form scattered strings.

### Input shape

```json
{
  "ticket": {
    "subject": "Where is my package?",
    "body": "It says delivered three days ago but I never got it.",
    "order_id": "ORD-10027",
    "order_status": "Delivered",
    "customer_history": "Customer contacted support once yesterday.",
    "policy_snippet": "Missing order claims require order ID and confirmation of shipping address."
  },
  "allowed_categories": [
    "Return request",
    "Refund request",
    "Damaged item",
    "Shipping delay / missing order",
    "Cancellation request",
    "Out of scope"
  ],
  "urgency_levels": ["Low", "Medium", "High"],
  "escalation_values": ["Escalate", "Do not escalate"],
  "rules": {
    "human_review_only": true,
    "never_auto_send": true,
    "never_auto_approve_refunds": true,
    "never_make_account_changes": true,
    "mark_unsupported_as_out_of_scope": true
  }
}
```

### Prompting approach

Use two layers:
- System prompt for hard behavior constraints
- User/task prompt containing ticket and policy context

The system prompt should explicitly require:
- one category only
- supported values only
- conservative suggested replies
- no claims of completed actions unless provided in input
- JSON-only output

## 7. AI Output Contract

The backend should require exact structured output and validate it before showing anything to the agent.

### Output schema

```json
{
  "category": "Shipping delay / missing order",
  "urgency": "High",
  "customer_issue_summary": "The customer reports that tracking shows delivered, but they have not received the order and want help locating it.",
  "suggested_reply": "Thanks for reaching out, and I'm sorry you're dealing with this. I can help review the missing order issue. Please confirm your order number and shipping address so our team can verify the next steps.",
  "policy_source_used": "Missing order claims require order ID and shipping verification.",
  "missing_information": [
    "Shipping address confirmation"
  ],
  "escalation_decision": "Do not escalate",
  "escalation_reason": "This is a supported category and the frontline agent can continue by gathering required information."
}
```

### Validation rules

The backend must validate:
- `category` is one of the six allowed values
- `urgency` is `Low`, `Medium`, or `High`
- `customer_issue_summary` is non-empty
- `suggested_reply` is non-empty
- `policy_source_used` is non-empty
- `missing_information` is an array of strings
- `escalation_decision` is `Escalate` or `Do not escalate`
- `escalation_reason` is non-empty

### Additional post-processing checks

The backend should reject or rewrite outputs that:
- say a refund is approved without source-confirmed approval
- say an order was changed or canceled automatically
- imply a message has already been sent
- contain an unsupported category

## 8. Escalation Logic

V1 should not rely only on the model for escalation. Use hybrid logic:
- model proposes escalation
- backend applies deterministic override rules

### Deterministic escalation rules

Always escalate when:
- Category is `Out of scope`
- Ticket mentions legal action, fraud, chargeback, attorney, regulator, or complaint language
- Ticket requests an exception to normal policy
- Model output fails validation

Usually escalate when:
- Customer is on repeated contact with no resolution
- Refund amount appears high-value based on available metadata
- Cancellation appears time-sensitive and fulfillment status is unclear
- Damage claim suggests safety risk or hazardous product issue

Usually do not escalate when:
- Ticket clearly fits one supported category
- Missing information can be gathered safely by the frontline agent
- No policy exception is needed

### Implementation suggestion

Represent escalation as a small rules engine:
- `keyword_risk_flags`
- `policy_exception_flag`
- `out_of_scope_flag`
- `validation_failure_flag`
- `repeat_contact_flag`

Then combine:
- If any hard flag is true, set `Escalate`
- Else use model decision unless internal heuristics suggest escalation

## 9. Out-of-Scope Handling

Out-of-scope handling should be explicit and safe, not treated like a model error.

### When to mark out of scope
- Ticket topic is not one of the five supported categories
- Ticket combines several issues and no single supported category is clear
- Ticket asks for actions outside support guidance, such as account security changes or billing disputes beyond refund handling
- Ticket is too ambiguous for a safe category assignment

### Required out-of-scope behavior
- Set `category` to `Out of scope`
- Set `escalation_decision` to `Escalate`
- Provide a short explanation in `escalation_reason`
- Suggested reply should avoid advice beyond acknowledging the issue and stating that the case needs manual review

### Safe fallback reply pattern
"Thanks for reaching out. Your request needs manual review by our support team so we can make sure it is handled correctly. A team member will review the details and follow up with the right next steps."

## 10. Main API Endpoints

The API can stay small in V1.

### `POST /api/tickets/analyze`
Purpose:
- Submit a ticket and generate a recommendation

Request:
- ticket fields from the intake screen

Response:
- ticket record
- recommendation record

### `GET /api/tickets`
Purpose:
- List past analyzed tickets for internal review

### `GET /api/tickets/:id`
Purpose:
- Return one ticket and its recommendation

### `POST /api/tickets/:id/review`
Purpose:
- Save the human review action and edited draft

## 11. Main Components

If using React, likely components are:
- `TicketInputForm`
- `SampleTicketPicker`
- `TicketDetailCard`
- `RecommendationPanel`
- `FieldBadge`
- `SuggestedReplyEditor`
- `MissingInfoList`
- `EscalationPanel`
- `ReviewHistoryTable`

This is enough structure without overengineering V1.

## 12. Sample Test Tickets

These should be stored as fixtures and used in manual QA and automated tests.

### 12.1 Return request

Subject:
`Need to return shoes`

Body:
`Hi, I received the sneakers yesterday, but they do not fit. I would like to return them and know the next steps. My order number is ORD-2001.`

Expected:
- Category: `Return request`
- Escalation: `Do not escalate`
- Missing information may be empty or ask for return reason details depending on policy

### 12.2 Refund request

Subject:
`Requesting refund for late delivery`

Body:
`My order arrived five days later than promised and I no longer need it. I want a refund. Order ID is ORD-2002.`

Expected:
- Category: `Refund request`
- Escalation: likely `Do not escalate`
- Missing information may ask whether item was kept or returned

### 12.3 Damaged item

Subject:
`Item arrived broken`

Body:
`The glass lid on the blender was shattered when I opened the box. I have pictures if needed. Order number ORD-2003.`

Expected:
- Category: `Damaged item`
- Urgency: `Medium` or `High`
- Missing information may ask for photos upload or confirmation of package condition

### 12.4 Shipping delay / missing order

Subject:
`Tracking says delivered but nothing came`

Body:
`Tracking shows my package was delivered two days ago, but I never received it. Can you help? Order ID ORD-2004.`

Expected:
- Category: `Shipping delay / missing order`
- Escalation: `Do not escalate` initially unless risk words are present

### 12.5 Cancellation request

Subject:
`Please cancel before it ships`

Body:
`I placed order ORD-2005 this morning by mistake. Please cancel it before it goes out.`

Expected:
- Category: `Cancellation request`
- Urgency: `High`
- Escalation depends on fulfillment status availability

### 12.6 Out-of-scope sample

Subject:
`I cannot log into my account`

Body:
`I think someone changed my password and I cannot access my account.`

Expected:
- Category: `Out of scope`
- Escalation: `Escalate`

## 13. Testing Strategy

### Unit tests
Cover:
- schema validation
- category allowlist enforcement
- urgency enum enforcement
- escalation override rules
- out-of-scope fallback behavior
- unsafe reply phrase detection

### Integration tests
Cover:
- `POST /api/tickets/analyze` end-to-end with mocked AI output
- malformed model JSON fallback
- valid ticket to review screen payload
- review save flow

### Manual QA
Check:
- agents can submit a ticket in under 30 seconds
- output always shows all required fields
- out-of-scope cases are clearly labeled
- suggested replies do not imply auto-approval or auto-action

## 14. Phased Build Plan

### Phase 0: Planning and contracts
Goal:
- Lock the categories, schema, guardrails, and sample fixtures

Deliverables:
- Product spec
- Implementation plan
- JSON schema for AI output
- Prompt draft
- Sample ticket fixture file

### Phase 1: Simplest working prototype
Goal:
- Analyze one pasted ticket and render structured output

Scope:
- Single-page UI
- Manual ticket text input
- One backend analyze endpoint
- One model prompt
- JSON schema validation
- No history, no auth, no external integrations

Usability bar:
- Internal demo works with supported sample tickets

### Phase 2: Safer internal tool
Goal:
- Make the prototype stable and usable by a small internal support team

Scope:
- Review screen improvements
- History screen
- Saved recommendations in SQLite
- Deterministic escalation overrides
- Explicit out-of-scope fallback handling
- Basic analytics fields such as review disposition

Usability bar:
- Agents can review, edit, and track ticket outcomes reliably

### Phase 3: Usable V1
Goal:
- Deliver a dependable internal V1 with clear workflows and test coverage

Scope:
- Better validation and failure handling
- Sample ticket loader for QA and demos
- Expanded manual QA set
- Audit-friendly storage of model output and final review action
- Policy snippet support in input flow

Usability bar:
- Small team can use it consistently without confusion
- Failure cases degrade safely
- Outputs are reviewable and traceable

## 15. Recommended Next Deliverables

The best next artifacts after this plan are:
- `AI_OUTPUT_SCHEMA.json`
- `PROMPT_SPEC.md`
- `sample-tickets.json`
- low-fidelity wireframes for intake and review screens

That sequence keeps us moving from abstract planning into implementation without jumping straight into production code.
