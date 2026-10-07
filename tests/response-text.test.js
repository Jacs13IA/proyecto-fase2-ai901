import assert from "node:assert/strict";
import test from "node:test";
import { extractResponseText } from "../lib/response-text.js";

test("consolida mensajes y bloques textuales conservando el orden", () => {
  const response = {
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: "Primera parte." },
          { type: "image", image_url: "ignored" },
          { type: "text", text: "Segunda parte." },
        ],
      },
      { type: "function_call", name: "ignored_tool" },
      {
        type: "message",
        content: [{ type: "output_text", text: "Respuesta posterior." }],
      },
    ],
    output_text: "No debe duplicarse.",
  };

  assert.equal(
    extractResponseText(response),
    "Primera parte.\n\nSegunda parte.\n\nRespuesta posterior.",
  );
});

test("usa el campo textual agregado solo como fallback", () => {
  assert.equal(
    extractResponseText({ output: [], output_text: "Texto del SDK" }),
    "Texto del SDK",
  );
});

test("preserva los espacios de cada fragmento textual", () => {
  assert.equal(
    extractResponseText({
      output: [
        { type: "message", content: [{ type: "output_text", text: "  inicio " }] },
        { type: "message", content: [{ type: "output_text", text: " final  " }] },
      ],
    }),
    "  inicio \n\n final  ",
  );
});

test("ignora salidas no textuales e inválidas", () => {
  assert.equal(
    extractResponseText({
      output: [
        null,
        { type: "image", text: "No mostrar" },
        { type: "message", content: [{ type: "image", text: "Tampoco" }] },
      ],
    }),
    "",
  );
});

test("incluye texto de rechazo en el lugar generado", () => {
  assert.equal(
    extractResponseText({
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "No puedo ayudar con eso." }],
        },
      ],
    }),
    "No puedo ayudar con eso.",
  );
});
