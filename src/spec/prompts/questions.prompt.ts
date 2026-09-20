import { readFileSync } from "node:fs";
import { join } from "node:path";

const SYSTEM_PROMPT_PATH = join(__dirname, "questions.system.md");

/**
 * System prompt for the Question agent.
 */
export const QUESTIONS_SYSTEM_PROMPT = readFileSync(
  SYSTEM_PROMPT_PATH,
  "utf8",
).trim();

/**
 * Builds the user turn that wraps raw intake for the Question agent.
 *
 * @param prd - Source intake or PRD text.
 */
export function buildQuestionsUserPrompt(prd: string): string {
  return [
    "Read the following product intake.",
    "Produce ranked clarification questions, then call save_questions.",
    "",
    "<prd>",
    prd,
    "</prd>",
  ].join("\n");
}
