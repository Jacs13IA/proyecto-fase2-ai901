function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addText(target, value) {
  if (typeof value === "string" && value.length > 0) {
    target.push(value);
  }
}

function collectContent(target, content) {
  if (typeof content === "string") {
    addText(target, content);
    return;
  }

  if (!Array.isArray(content)) {
    return;
  }

  for (const block of content) {
    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "output_text" || block.type === "text") {
      addText(target, block.text);
    } else if (block.type === "refusal") {
      addText(target, block.refusal);
    }
  }
}

function collectOutput(target, output) {
  if (!Array.isArray(output)) {
    return;
  }

  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }

    if (item.type === "message" || (item.type === undefined && item.role === "assistant")) {
      collectContent(target, item.content ?? item.parts);
    } else if (item.type === "output_text" || item.type === "text") {
      addText(target, item.text);
    } else if (item.type === "refusal") {
      addText(target, item.refusal);
    }
  }
}

export function extractResponseText(response) {
  const fragments = [];
  const output = Array.isArray(response?.output)
    ? response.output
    : Array.isArray(response?.messages)
      ? response.messages
      : [];

  collectOutput(fragments, output);

  if (fragments.length === 0) {
    addText(fragments, response?.output_text ?? response?.text);
  }

  return fragments.join("\n\n");
}
