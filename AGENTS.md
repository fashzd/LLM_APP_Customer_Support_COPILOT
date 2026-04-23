# Customer Support Copilot

## Product goal
Build a V1 ecommerce customer support copilot for human support agents.

## Supported ticket categories
- Return request
- Refund request
- Damaged item
- Shipping delay / missing order
- Cancellation request

## Safety and product rules
- Human review only
- Never auto-send messages
- Never auto-approve refunds
- Never make account changes automatically
- If a ticket is outside the 5 supported categories, mark it as Out of scope

## Required AI output
For each ticket, return:
- Category
- Urgency
- Customer issue summary
- Suggested reply
- Policy/source used
- Missing information
- Escalation decision
- Escalation reason