# Customer Support Copilot

An internal AI-powered ecommerce support tool that helps human agents classify tickets, draft safe replies, surface missing information, and decide whether a case should be escalated.

This project was built as a narrow, human-in-the-loop V1. Instead of trying to automate all customer support, it focuses on a limited set of common ecommerce cases and wraps AI output in validation, fallback handling, review tracking, and QA tooling.

## Overview

Customer Support Copilot is designed for human support agents handling inbound ecommerce tickets. The app accepts a customer ticket, analyzes it against a constrained support scope, and returns a structured recommendation that includes:

- category
- urgency
- customer issue summary
- suggested reply
- policy/source used
- missing information
- escalation decision
- escalation reason

The product is intentionally conservative:

- it never auto-sends replies
- it never auto-approves refunds
- it never makes account changes
- unsupported or ambiguous tickets are pushed to `Out of scope`
- every recommendation is presented for human review only

## Supported Ticket Categories

- Return request
- Refund request
- Damaged item
- Shipping delay / missing order
- Cancellation request

Anything outside those categories is marked `Out of scope`.

## Key Features

- Full-stack internal tool with a browser UI and local backend
- Structured AI recommendation output validated against JSON schema
- Safe fallback response if model output is invalid or unsafe
- Human-in-the-loop review workflow with final disposition tracking
- Local SQLite persistence for analyzed tickets, recommendations, and review actions
- Review history with reopen flow for past tickets
- Sample fixture set for manual QA
- Regression fixture set for borderline ticket analysis cases
- Traceable fallback metadata including reason, code, and trace ID
- Optional OpenAI-backed analysis with a built-in deterministic fallback path

## Tech Stack

### Frontend

- HTML
- CSS
- Vanilla JavaScript

### Backend

- Node.js
- Native `http` server
- Native `sqlite` module

### AI / Validation

- Prompt-based ticket analysis
- JSON Schema validation
- Structured output contract
- Heuristic fallback analysis

### Testing

- Node.js built-in test runner
- Fixture-based regression testing

## Screenshots

Main UI screenshots included in the repo:

- [Screenshot 1](/Users/jarvis/Desktop/Customer_Support_Copilot/Screenshot%202026-04-26%20at%2000.45.17.png)
- [Screenshot 2](/Users/jarvis/Desktop/Customer_Support_Copilot/Screenshot%202026-04-26%20at%2000.45.33.png)

Recommended portfolio additions:

- intake + recommendation view
- review history view
- sample/regression QA flow
- short GIF showing analyze -> review -> save review action

## How It Works

### Ticket flow

1. A support agent pastes a ticket or loads a fixture ticket.
2. The frontend sends the ticket to the backend.
3. The backend validates and normalizes the input.
4. The analyzer generates a structured recommendation.
5. The output is validated against [AI_OUTPUT_SCHEMA.json](/Users/jarvis/Desktop/Customer_Support_Copilot/AI_OUTPUT_SCHEMA.json).
6. If the output is invalid or unsafe, the system returns a safe fallback recommendation.
7. The agent reviews the output, optionally edits the reply, and saves a final review action.

### Architecture summary

```text
Browser UI
  -> Node.js API
    -> Ticket input validation
    -> Analyzer / prompt layer
    -> Schema validation + fallback handling
    -> SQLite persistence
  -> Review history + final review actions
```

### Core project files

- [public/index.html](/Users/jarvis/Desktop/Customer_Support_Copilot/public/index.html)
- [public/app.js](/Users/jarvis/Desktop/Customer_Support_Copilot/public/app.js)
- [public/styles.css](/Users/jarvis/Desktop/Customer_Support_Copilot/public/styles.css)
- [server/index.js](/Users/jarvis/Desktop/Customer_Support_Copilot/server/index.js)
- [server/analyzer.js](/Users/jarvis/Desktop/Customer_Support_Copilot/server/analyzer.js)
- [server/storage.js](/Users/jarvis/Desktop/Customer_Support_Copilot/server/storage.js)
- [server/ticketInput.js](/Users/jarvis/Desktop/Customer_Support_Copilot/server/ticketInput.js)

## AI Engineering Decisions

This project is deliberately structured to show practical AI product engineering rather than just “calling an LLM.”

### Structured outputs

The recommendation output is defined and validated using:

- [AI_OUTPUT_SCHEMA.json](/Users/jarvis/Desktop/Customer_Support_Copilot/AI_OUTPUT_SCHEMA.json)
- [PROMPT_SPEC.md](/Users/jarvis/Desktop/Customer_Support_Copilot/PROMPT_SPEC.md)

This keeps outputs machine-checkable and easier to trust in downstream workflows.

### Conservative fallback behavior

If the model output is malformed, unsupported, or contains unsafe wording, the backend replaces it with a safe fallback response instead of showing risky output directly.

### Human-in-the-loop guardrails

The UI always frames the result as requiring human review. The app never performs automated customer actions.

### Narrow scope over fake completeness

The app supports a limited set of ticket categories on purpose. Ambiguous or unsupported cases are escalated instead of being overfit to the wrong class.

## Review Workflow

The app stores:

- analyzed ticket data
- AI recommendation output
- validation/fallback metadata
- final review action
- reviewer name
- edited reply
- review notes
- review timestamps

This makes the tool more realistic as an internal support workflow rather than just a one-off AI demo.

## QA and Testing

### Automated tests

Run:

```bash
npm test
```

The test suite covers:

- supported ticket analysis
- out-of-scope analysis
- schema validation
- fallback behavior
- unsafe wording handling
- context-aware missing information
- review-action persistence
- regression checks for borderline cases

### Manual QA support

Two fixture sets are included:

- [sample-tickets.json](/Users/jarvis/Desktop/Customer_Support_Copilot/sample-tickets.json)
- [regression-tickets.json](/Users/jarvis/Desktop/Customer_Support_Copilot/regression-tickets.json)

The UI lets you:

- load core sample tickets
- switch to regression tickets
- compare expected vs actual category and escalation behavior

## Running Locally

### Requirements

- Node.js 22 or newer

### Start the app

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

The app creates a local SQLite database automatically at:

```text
data/copilot.db
```

### Development mode

```bash
npm run dev
```

This runs the Node server in watch mode.

## Optional OpenAI Integration

The app works without an API key by using a built-in deterministic analyzer.

To try OpenAI-backed analysis:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-4o-mini
npm start
```

If the OpenAI call fails or returns invalid output, the backend falls back to a safe internal response.

## API Summary

### `GET /api/sample-tickets`

Returns the core sample fixture set.

### `GET /api/regression-tickets`

Returns the regression fixture set for borderline cases.

### `POST /api/tickets/analyze`

Accepts ticket input and returns:

- saved ticket
- recommendation
- validation/fallback metadata

### `GET /api/history`

Returns prior analyzed tickets and review status.

### `GET /api/history/:id`

Returns a saved ticket, recommendation, and stored review action.

### `POST /api/tickets/:id/review`

Stores the final human review action for a ticket.

## Why This Project Matters

This project demonstrates the difference between a basic AI demo and a more thoughtful internal AI product.

It shows how to:

- scope an AI workflow tightly
- wrap LLM output in validation and safety checks
- build reliable fallback behavior
- persist human review outcomes
- design for explainability and traceability
- create a QA loop for both manual and automated evaluation

## What I Learned

- how to build a full-stack MVP from product spec to usable internal tool
- how to design AI prompts and structured output contracts around business rules
- how to combine LLM usage with validation, fallback logic, and human review
- how to treat QA and regression testing as core parts of AI product development
- how to iterate UI and workflow design without expanding product scope unnecessarily

## Future Improvements

- add filters and search in review history
- support richer reviewer audit trails instead of one latest review action
- add confidence scoring and evaluation metrics
- improve side-by-side comparison between original AI recommendation and final human outcome
- add external helpdesk or ecommerce integrations in a later version

## Related Project Docs

- [PRODUCT_SPEC.md](/Users/jarvis/Desktop/Customer_Support_Copilot/PRODUCT_SPEC.md)
- [IMPLEMENTATION_PLAN.md](/Users/jarvis/Desktop/Customer_Support_Copilot/IMPLEMENTATION_PLAN.md)
- [PROMPT_SPEC.md](/Users/jarvis/Desktop/Customer_Support_Copilot/PROMPT_SPEC.md)
- [AI_OUTPUT_SCHEMA.json](/Users/jarvis/Desktop/Customer_Support_Copilot/AI_OUTPUT_SCHEMA.json)

