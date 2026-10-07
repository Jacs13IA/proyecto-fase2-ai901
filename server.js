import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import express from "express";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractResponseText } from "./lib/response-text.js";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_ID_LENGTH = 256;

export function createApp({ openai, agentName }) {
  if (!openai || typeof agentName !== "string" || !agentName.trim()) {
    throw new Error("An OpenAI client and Foundry agent name are required.");
  }

  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/chat", async (request, response) => {
    const body = request.body;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const conversationId = body?.conversation_id;

    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      response.status(422).json({
        error: "El mensaje debe tener entre 1 y 2000 caracteres.",
      });
      return;
    }

    if (
      conversationId !== undefined &&
      (typeof conversationId !== "string" ||
        !conversationId.trim() ||
        conversationId.length > MAX_CONVERSATION_ID_LENGTH)
    ) {
      response.status(422).json({ error: "El identificador de conversación no es válido." });
      return;
    }

    try {
      const conversation =
        conversationId ?? (await openai.conversations.create()).id;

      if (typeof conversation !== "string" || !conversation) {
        throw new Error("Foundry did not return a conversation identifier.");
      }

      const agentRef = {
        body: {
          agent_reference: {
            name: agentName,
            type: "agent_reference",
          },
        },
      };
      const result = await openai.responses.create(
        { conversation, input: message },
        agentRef,
      );
      const reply = extractResponseText(result);

      if (!reply.trim()) {
        response.status(502).json({
          error: "No se pudo obtener una respuesta del agente.",
        });
        return;
      }

      response.json({ response: reply, conversation_id: conversation });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(`Foundry chat request failed (${errorName}).`);
      response.status(502).json({
        error: "No se pudo completar la solicitud al agente. Inténtalo de nuevo.",
      });
    }
  });

  app.use(express.static(join(import.meta.dirname, "public")));

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error?.type === "entity.parse.failed") {
      response.status(400).json({ error: "El cuerpo de la solicitud no es JSON válido." });
      return;
    }

    if (error?.type === "entity.too.large") {
      response.status(413).json({ error: "La solicitud excede el tamaño permitido." });
      return;
    }

    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`Request handling failed (${errorName}).`);
    response.status(500).json({ error: "Ocurrió un error interno." });
  });

  return app;
}

async function startServer() {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const agentName = process.env.FOUNDRY_AGENT_NAME;

  if (!endpoint?.trim() || !agentName?.trim()) {
    throw new Error(
      "FOUNDRY_PROJECT_ENDPOINT y FOUNDRY_AGENT_NAME deben estar configuradas.",
    );
  }

  const project = new AIProjectClient(
    endpoint.trim(),
    new DefaultAzureCredential(),
  );
  const openai = project.getOpenAIClient();
  const app = createApp({ openai, agentName: agentName.trim() });
  const port = Number(process.env.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT debe ser un número entero entre 1 y 65535.");
  }

  app.listen(port, () => {
    console.log(`Chatbot disponible en el puerto ${port}.`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido.";
    console.error("No se pudo iniciar el servidor:", errorMessage);
    process.exitCode = 1;
  });
}
