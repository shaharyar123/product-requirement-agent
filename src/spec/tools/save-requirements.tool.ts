import type OpenAI from "openai";

/** Tool name registered with the Groq/OpenAI chat completions API. */
export const SAVE_REQUIREMENTS_TOOL_NAME = "save_requirements";

/**
 * OpenAI-compatible tool definition for persisting the refined requirements document.
 */
export const SAVE_REQUIREMENTS_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: SAVE_REQUIREMENTS_TOOL_NAME,
    description:
      "Save the final product requirements document after analysis is complete.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Complete product requirements document in Markdown.",
        },
      },
      required: ["content"],
    },
  },
};

/**
 * Reads the Markdown payload from a save_requirements tool call.
 *
 * @param rawArguments - JSON string supplied by the model.
 * @returns Trimmed Markdown, or null when the payload is invalid.
 */
export function parseSaveRequirementsArgs(rawArguments: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("content" in parsed) ||
    typeof parsed.content !== "string"
  ) {
    return null;
  }

  const content = parsed.content.trim();
  return content.length > 0 ? content : null;
}
