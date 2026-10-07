import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const requiredVariables = [
  "FOUNDRY_PROJECT_ENDPOINT",
  "FOUNDRY_AGENT_NAME",
  "FOUNDRY_MODEL_DEPLOYMENT",
  "FOUNDRY_AGENT_INSTRUCTIONS",
];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(`Faltan variables de entorno: ${missingVariables.join(", ")}.`);
  process.exitCode = 1;
} else {
  try {
    const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT.trim();
    const agentName = process.env.FOUNDRY_AGENT_NAME.trim();
    const modelDeployment = process.env.FOUNDRY_MODEL_DEPLOYMENT.trim();
    const project = new AIProjectClient(
      endpoint,
      new DefaultAzureCredential(),
    );
    const agent = await project.agents.createVersion(
      agentName,
      {
        kind: "prompt",
        model: modelDeployment,
        instructions: process.env.FOUNDRY_AGENT_INSTRUCTIONS,
      },
    );

    console.log(
      `Agente creado: ${agent.name} (versión ${agent.version}, id ${agent.id}).`,
    );
  } catch (error) {
    console.error("No se pudo crear el agente:", error.message);
    process.exitCode = 1;
  }
}
