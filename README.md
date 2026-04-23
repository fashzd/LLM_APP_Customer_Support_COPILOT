# Customer Support Copilot Phase 1 Prototype

This is the simplest working Phase 1 prototype for the ecommerce Customer Support Copilot described in:
- [PRODUCT_SPEC.md](/Users/jarvis/Desktop/Customer_Support_Copilot/PRODUCT_SPEC.md)
- [IMPLEMENTATION_PLAN.md](/Users/jarvis/Desktop/Customer_Support_Copilot/IMPLEMENTATION_PLAN.md)
- [AI_OUTPUT_SCHEMA.json](/Users/jarvis/Desktop/Customer_Support_Copilot/AI_OUTPUT_SCHEMA.json)
- [PROMPT_SPEC.md](/Users/jarvis/Desktop/Customer_Support_Copilot/PROMPT_SPEC.md)
- [sample-tickets.json](/Users/jarvis/Desktop/Customer_Support_Copilot/sample-tickets.json)

Phase 2 adds lightweight local persistence and a simple review history screen while keeping the existing Phase 1 analyze flow unchanged.

## What It Includes

- Minimal full-stack web app
- One ticket intake screen
- One recommendation review screen
- Manual ticket input
- Sample ticket loader backed by `sample-tickets.json`
- `Analyze Ticket` action that sends data to a backend endpoint
- Schema validation against `AI_OUTPUT_SCHEMA.json`
- Safe fallback response if generated output fails validation
- Clear `Needs human review` status in the UI
- Local SQLite persistence for analyzed tickets and recommendations
- Simple review history table with reopen flow
- No auth
- No helpdesk or ecommerce integrations
- No auto-send behavior

## Folder Structure

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server/
│   ├── analyzer.js
│   ├── fallback.js
│   ├── index.js
│   ├── promptLoader.js
│   ├── schemaValidator.js
│   └── storage.js
├── data/
│   └── copilot.db
├── tests/
│   └── analyzer.test.js
├── AI_OUTPUT_SCHEMA.json
├── IMPLEMENTATION_PLAN.md
├── PRODUCT_SPEC.md
├── PROMPT_SPEC.md
├── README.md
├── package.json
└── sample-tickets.json
```

## Run The App

### Requirements

- Node.js 22 or newer

### Start

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

On first run, the app creates a local SQLite database at `data/copilot.db` automatically.

### Development mode

```bash
npm run dev
```

## Run Tests

```bash
npm test
```

The test suite covers:
- supported ticket analysis
- out-of-scope ticket analysis
- schema validation
- safe fallback behavior
- context-aware missing information for account-access issues
- conservative cancellation reply wording

## Phase 2 History Behavior

- Each successful analysis is saved locally.
- The Review History section shows:
  - ticket ID
  - created time
  - category
  - urgency
  - escalation decision
- Selecting `Open` loads the saved ticket and recommendation back into the intake and review screens.

## Optional OpenAI Model Support

The prototype works without an API key by using a deterministic local analyzer.

If you want the backend to call OpenAI first and fall back safely if needed, set:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-4o-mini
```

Then run:

```bash
npm start
```

If the OpenAI call fails, returns malformed data, or produces invalid output, the server returns a safe fallback response instead of unsafe content.

## API Endpoints

### `GET /api/sample-tickets`

Returns the sample tickets from `sample-tickets.json`.

### `POST /api/tickets/analyze`

Request body:

```json
{
  "subject": "Please cancel my order",
  "body": "I placed order ORD-2005 this morning by mistake. Please cancel it before it goes out.",
  "order_id": "ORD-2005",
  "order_status": "Processing",
  "customer_history": "No prior support contact.",
  "policy_snippet": "Cancellation requests can be reviewed before shipment but are not guaranteed once fulfillment begins."
}
```

Response shape:

```json
{
  "ticket": {},
  "recommendation": {},
  "meta": {
    "source": "heuristic",
    "validation": {
      "valid": true,
      "errors": []
    }
  }
}
```

## Assumptions

- To keep Phase 1 simple and easy to run, the app uses plain Node.js and a static frontend instead of a heavier framework.
- Phase 2 uses Node's built-in SQLite module for lightweight local persistence.
- The backend can run in two modes: optional OpenAI-backed analysis or a built-in deterministic analyzer when no API key is present.
- Schema validation is implemented locally against the project schema so the prototype stays dependency-light.
- `External integrations` was interpreted as no ecommerce platform, helpdesk, auth, or auto-action integrations in Phase 1.

## Safety Notes

- The UI always shows `Needs human review`.
- The app never auto-sends replies.
- The app never auto-approves refunds.
- The app never makes account changes.
- Unsupported or ambiguous tickets are pushed toward `Out of scope` and escalation.
