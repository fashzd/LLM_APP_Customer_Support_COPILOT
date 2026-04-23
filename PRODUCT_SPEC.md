# Customer Support Copilot V1 Product Spec

## 1. Overview

### Product name
Customer Support Copilot

### Goal
Build a V1 ecommerce customer support copilot that helps human support agents review inbound customer tickets, classify them, and draft safe suggested responses.

### Product principle
This is a decision-support tool for human agents, not an autonomous support bot. All outputs are advisory and require human review before any action is taken.

## 2. Problem Statement

Support teams spend too much time manually reading tickets, identifying the issue type, checking basic policy context, and drafting replies. This slows response times and creates inconsistency across agents.

V1 should reduce that manual overhead by producing a structured recommendation for a limited set of common ecommerce cases while keeping humans in control.

## 3. V1 Scope

### In scope
The copilot supports only these five ticket categories:
- Return request
- Refund request
- Damaged item
- Shipping delay / missing order
- Cancellation request

For each supported ticket, the copilot must return:
- Category
- Urgency
- Customer issue summary
- Suggested reply
- Policy/source used
- Missing information
- Escalation decision
- Escalation reason

### Out of scope
- Any ticket outside the five supported categories
- Automatically sending replies
- Automatically approving refunds
- Automatically making account changes
- Fully autonomous customer support
- Multi-ticket workflows or long-running case management
- Deep integrations with order systems, payment systems, or carrier systems in V1

If a ticket is outside the five supported categories, the system must mark it as `Out of scope`.

## 4. Target User

### Primary user
Human ecommerce support agents handling inbound customer tickets.

### User need
Agents need a fast, reliable first draft that helps them understand the issue, identify missing information, and decide whether the case needs escalation.

## 5. Core User Stories

1. As a support agent, I want the copilot to classify a ticket into a supported category so I can route and handle it faster.
2. As a support agent, I want a short customer issue summary so I can quickly understand the case.
3. As a support agent, I want a suggested reply I can edit before sending so I can respond more efficiently.
4. As a support agent, I want the policy or source cited so I understand why the recommendation was made.
5. As a support agent, I want missing information called out so I know what follow-up questions to ask.
6. As a support agent, I want an escalation recommendation and reason so I can handle riskier cases consistently.
7. As a support lead, I want the product to stay within narrow safety guardrails so agents remain accountable for final decisions.

## 6. Functional Requirements

### 6.1 Ticket intake
The system accepts a single customer support ticket as input.

Minimum V1 input:
- Ticket text/body

Optional V1 input:
- Ticket subject
- Order ID
- Order status
- Customer message history
- Store policy snippets

### 6.2 Ticket classification
The system must classify the ticket into exactly one of:
- Return request
- Refund request
- Damaged item
- Shipping delay / missing order
- Cancellation request
- Out of scope

If the system lacks confidence or the ticket does not fit one of the supported categories, it should choose `Out of scope`.

### 6.3 Structured AI output
For every ticket, the system must return a structured response with the following fields:

#### Category
One supported category or `Out of scope`.

#### Urgency
A simple label for agent prioritization. V1 uses:
- Low
- Medium
- High

Suggested guidance:
- `High`: customer reports severe frustration, repeated failed contact, time-sensitive cancellation, or missing/damaged order with strong customer impact
- `Medium`: standard operational issue needing follow-up soon
- `Low`: routine request with no strong time pressure

#### Customer issue summary
One to three sentences summarizing the customer’s main issue in plain language.

#### Suggested reply
A polite, professional draft for a human agent to review and edit before sending.

The suggested reply should:
- Acknowledge the issue
- Avoid overpromising
- Avoid stating that a refund, return, cancellation, or replacement is already approved unless a human confirms it
- Ask for any required missing information when necessary

#### Policy/source used
The policy, guidance, or source the recommendation is based on.

In V1 this may include:
- A named internal support policy
- A provided store policy snippet
- A generic fallback such as `No matching store policy provided; based on supported ticket handling rules`

#### Missing information
A list of any information needed before a human agent can proceed confidently.

Examples:
- Order number
- Photos of damaged item
- Confirmation of delivery status
- Reason for return
- Timing of cancellation request

#### Escalation decision
One of:
- Escalate
- Do not escalate

#### Escalation reason
A short explanation for the escalation decision.

Examples of escalation triggers:
- Policy exception may be required
- High-value refund request
- Threat of chargeback or legal complaint
- Repeated customer contact with no resolution
- Insufficient information for safe guidance
- Ticket is out of scope

### 6.4 Human review flow
The product must clearly present AI output as a recommendation for human review.

V1 must ensure:
- Human agent reviews the response before use
- Human agent decides whether to send, edit, ignore, or escalate
- Human agent remains responsible for final actions

## 7. Safety Requirements

These are hard requirements for V1:
- Human review only
- Never auto-send messages
- Never auto-approve refunds
- Never make account changes automatically
- Mark unsupported tickets as `Out of scope`

Additional V1 safety expectations:
- Do not claim actions have already been taken unless confirmed by system data
- Do not fabricate policy details not present in provided sources
- Do not make guarantees about refunds, replacements, returns, or delivery outcomes
- Prefer asking for missing information over making risky assumptions

## 8. UX Requirements

### Agent-facing experience
The UI should show:
- Original ticket
- AI-generated structured output
- Clear badge indicating `Suggested` or `Needs human review`
- Easy-to-scan sections for summary, suggested reply, missing information, and escalation

### UX principles
- Fast to scan in under 30 seconds
- Structured enough for consistency
- Conservative wording for risky scenarios
- Transparent reasoning through the policy/source field

## 9. Decision Logic Guidelines

### Category selection
- Choose the closest supported category when the customer intent is clear.
- Choose `Out of scope` when the issue falls outside the supported set or is too ambiguous.

### Urgency selection
- Use `High` only when there is clear customer impact, time sensitivity, or risk escalation.
- Default to `Medium` for standard support cases.
- Use `Low` for routine requests with limited urgency.

### Escalation selection
Escalate when:
- The ticket is out of scope
- A policy exception appears necessary
- The case has legal, financial, or reputational risk
- There is no safe recommendation without deeper review

Do not escalate when:
- The case is a standard supported request and the required next step is clear

## 10. Non-Functional Requirements

### Reliability
- Output should always include all required fields
- Output should remain within supported categories and safety rules

### Explainability
- Each recommendation should include a policy/source field and escalation reason

### Consistency
- Similar tickets should produce similarly structured outputs

### Speed
- The copilot should feel fast enough to fit naturally into an agent workflow

## 11. Example Output Schema

```json
{
  "category": "Refund request",
  "urgency": "Medium",
  "customer_issue_summary": "The customer says they were charged but wants a refund because the item arrived later than expected.",
  "suggested_reply": "Thanks for reaching out, and I'm sorry for the frustration. I can help review your refund request. Please share your order number and confirm whether you kept or returned the item so our team can review the next steps.",
  "policy_source_used": "Refund policy - delayed delivery review",
  "missing_information": [
    "Order number",
    "Whether the item was delivered and kept"
  ],
  "escalation_decision": "Do not escalate",
  "escalation_reason": "This appears to be a standard supported refund request and more information can be gathered by the frontline agent."
}
```

## 12. Success Criteria For V1

V1 is successful if:
- Agents can submit a ticket and receive all required output fields
- Outputs stay within the five supported categories or correctly mark `Out of scope`
- Suggested replies are usable as first drafts and require only light editing in common cases
- The system consistently flags missing information
- The system does not take autonomous actions
- Human reviewers can understand why the system suggested a given response

## 13. Launch Risks

- Misclassification between similar categories such as return vs refund
- Overconfident reply drafts that imply approval or action
- Weak or missing policy grounding
- Ambiguous tickets incorrectly handled instead of marked `Out of scope`
- Inconsistent escalation recommendations

## 14. Future Versions

Potential post-V1 expansions:
- More supported ticket categories
- Confidence scoring
- Retrieval from live store policies
- Integrations with ecommerce platforms and helpdesk tools
- Suggested macros or workflow actions for agents
- Review analytics and agent feedback loops
