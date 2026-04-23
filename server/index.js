import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeTicket } from "./analyzer.js";
import { createStorage } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sampleTicketsPath = path.join(rootDir, "sample-tickets.json");
const schemaPath = path.join(rootDir, "AI_OUTPUT_SCHEMA.json");
const promptSpecPath = path.join(rootDir, "PROMPT_SPEC.md");
const dbPath = path.join(rootDir, "data", "copilot.db");
const port = Number(process.env.PORT || 3000);
const storage = createStorage({ dbPath });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function serveStaticAsset(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.normalize(path.join(publicDir, safePath));

  if (!resolvedPath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(resolvedPath);
    const extension = path.extname(resolvedPath);

    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not Found");
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/sample-tickets") {
      const sampleTickets = JSON.parse(await readFile(sampleTicketsPath, "utf8"));
      return sendJson(response, 200, sampleTickets);
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/tickets/analyze") {
      const body = await readJsonBody(request);
      const ticket = {
        subject: body.subject?.trim() || "",
        body: body.body?.trim() || "",
        order_id: body.order_id?.trim() || "",
        order_status: body.order_status?.trim() || "",
        customer_history: body.customer_history?.trim() || "",
        policy_snippet: body.policy_snippet?.trim() || ""
      };

      if (!ticket.body) {
        return sendJson(response, 400, {
          error: "Ticket body is required."
        });
      }

      const analysis = await analyzeTicket({
        ticket,
        schemaPath,
        promptSpecPath
      });
      const saved = storage.saveAnalysis(ticket, analysis);

      return sendJson(response, 200, {
        ticket: saved.ticket,
        recommendation: saved.recommendation,
        meta: analysis.meta
      });
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/history") {
      return sendJson(response, 200, storage.getHistory());
    }

    if (request.method === "GET" && requestUrl.pathname.startsWith("/api/history/")) {
      const ticketId = Number(requestUrl.pathname.split("/").pop());

      if (!Number.isInteger(ticketId) || ticketId < 1) {
        return sendJson(response, 400, {
          error: "Valid ticket ID is required."
        });
      }

      const savedAnalysis = storage.getAnalysis(ticketId);

      if (!savedAnalysis) {
        return sendJson(response, 404, {
          error: "Ticket not found."
        });
      }

      return sendJson(response, 200, savedAnalysis);
    }

    if (request.method === "GET") {
      return serveStaticAsset(requestUrl.pathname, response);
    }

    response.writeHead(405);
    response.end("Method Not Allowed");
  } catch (error) {
    return sendJson(response, 500, {
      error: "Unexpected server error.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Customer Support Copilot running on http://localhost:${port}`);
});
