import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../server.js";

async function withServer(openai, testRequest) {
  const server = createApp({ openai, agentName: "test-agent" }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");

  try {
    const address = server.address();
    await testRequest(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function createFakeOpenAI(responses) {
  const calls = [];
  let responseIndex = 0;

  return {
    calls,
    client: {
      conversations: {
        create: async () => ({ id: "conv_test_123" }),
      },
      responses: {
        create: async (...args) => {
          calls.push(args);
          return responses[responseIndex++];
        },
      },
    },
  };
}

test("GET /health devuelve el estado esperado", async () => {
  const { client } = createFakeOpenAI([]);

  await withServer(client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("sirve el frontend desde la raíz", async () => {
  const { client } = createFakeOpenAI([]);

  await withServer(client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Certificador de Tecnologías de Microsoft/);
  });
});

test("rechaza mensajes vacíos con HTTP 422 sin llamar a Foundry", async () => {
  const fake = createFakeOpenAI([]);

  await withServer(fake.client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });

    assert.equal(response.status, 422);
    assert.equal(fake.calls.length, 0);
  });
});

test("rechaza mensajes que exceden el límite con HTTP 422", async () => {
  const fake = createFakeOpenAI([]);

  await withServer(fake.client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "a".repeat(2001) }),
    });

    assert.equal(response.status, 422);
    assert.equal(fake.calls.length, 0);
  });
});

test("responde 400 sin filtrar detalles para JSON malformado", async () => {
  const fake = createFakeOpenAI([]);

  await withServer(fake.client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"message":',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: "El cuerpo de la solicitud no es JSON válido." });
  });
});

test("conserva la conversación en seguimientos y consolida todos los textos", async () => {
  const fake = createFakeOpenAI([
    {
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "Respuesta inicial." },
            { type: "output_text", text: "Detalle inicial." },
          ],
        },
      ],
    },
    {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Respuesta de seguimiento." }],
        },
      ],
    },
  ]);

  await withServer(fake.client, async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Primera pregunta" }),
    });
    const firstBody = await firstResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.deepEqual(firstBody, {
      response: "Respuesta inicial.\n\nDetalle inicial.",
      conversation_id: "conv_test_123",
    });

    const secondResponse = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Pregunta de seguimiento",
        conversation_id: firstBody.conversation_id,
      }),
    });
    const secondBody = await secondResponse.json();

    assert.equal(secondResponse.status, 200);
    assert.equal(secondBody.conversation_id, "conv_test_123");
    assert.equal(secondBody.response, "Respuesta de seguimiento.");
    assert.equal(fake.calls.length, 2);
    assert.deepEqual(fake.calls[0], [
      { conversation: "conv_test_123", input: "Primera pregunta" },
      {
        body: {
          agent_reference: {
            name: "test-agent",
            type: "agent_reference",
          },
        },
      },
    ]);
    assert.equal(fake.calls[1][0].conversation, "conv_test_123");
  });
});

test("no expone errores internos de Foundry al cliente", async () => {
  const fake = createFakeOpenAI([]);
  fake.client.responses.create = async () => {
    throw new Error("sensitive internal detail");
  };

  await withServer(fake.client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Pregunta" }),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error.includes("sensitive internal detail"), false);
  });
});

test("rechaza respuestas sin contenido textual con HTTP 502", async () => {
  const fake = createFakeOpenAI([{ output: [{ type: "function_call" }] }]);

  await withServer(fake.client, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Pregunta" }),
    });

    assert.equal(response.status, 502);
  });
});
