import { readFileSync } from "node:fs";
import { join } from "node:path";

const SYSTEM_PROMPT_PATH = join(__dirname, "planning.system.md");

/**
 * System prompt for the Planning agent.
 */
export const PLANNING_SYSTEM_PROMPT = readFileSync(
  SYSTEM_PROMPT_PATH,
  "utf8",
).trim();

/**
 * Builds the user turn that wraps intake for the Planning agent.
 *
 * @param prd - Requirements artifact or raw PRD text.
 */
export function buildPlanningUserPrompt(prd: string): string {
  return [
    "Build a factory handoff plan from the following product document.",
    "When the packet is complete, call save_plan.",
    "",
    "<prd>",
    prd,
    "</prd>",
  ].join("\n");
}
