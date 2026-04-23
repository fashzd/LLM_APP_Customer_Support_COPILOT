import { readFile } from "node:fs/promises";

function extractCodeBlock(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escapedHeading + "[\\s\\S]*?```(?:text)?\\n([\\s\\S]*?)```", "m");
  const match = markdown.match(pattern);

  if (!match) {
    throw new Error(`Unable to find code block for heading: ${heading}`);
  }

  return match[1].trim();
}

export async function loadPromptSpec(promptSpecPath) {
  const markdown = await readFile(promptSpecPath, "utf8");

  return {
    systemPrompt: extractCodeBlock(markdown, "## System Prompt"),
    taskPromptTemplate: extractCodeBlock(markdown, "## Task Prompt Template")
  };
}
