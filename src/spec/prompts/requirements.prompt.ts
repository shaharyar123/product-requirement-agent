import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ClarificationAnswer } from "../interfaces/clarification-answer.interface";

const SYSTEM_PROMPT_PATH = join(__dirname, "requirements.system.md");

/**
 * System prompt for the Requirements agent.
 * Loaded from `requirements.system.md` so prompt edits stay out of runtime code.
 */
export const REQUIREMENTS_SYSTEM_PROMPT = readFileSync(
  SYSTEM_PROMPT_PATH,
  "utf8",
).trim();

/**
 * Builds the user turn that wraps a raw PRD and optional human answers.
 *
 * @param prd - Source product requirements text.
 * @param answers - Clarification answers from the Question-agent gate.
 * @returns Chat user message content.
 */
export function buildRequirementsUserPrompt(
  prd: string,
  answers: ClarificationAnswer[] = [],
): string {
  const parts = [
    "Analyze the following product requirements document.",
    "When analysis is complete, call save_requirements with the full Markdown document.",
    "",
    "<prd>",
    prd,
    "</prd>",
  ];

  if (answers.length > 0) {
    parts.push("", "<answers>");
    for (const item of answers) {
      if (item.question) {
        parts.push(`${item.id}: ${item.question}`);
        parts.push(`Answer: ${item.answer}`);
      } else {
        parts.push(`${item.id}: ${item.answer}`);
      }
    }
    parts.push("</answers>");
  }

  return parts.join("\n");
}
