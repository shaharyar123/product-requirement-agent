import type OpenAI from "openai";
import { ClarificationQuestion } from "../interfaces/clarification-question.interface";

/** Tool name registered with the Groq/OpenAI chat completions API. */
export const SAVE_QUESTIONS_TOOL_NAME = "save_questions";

/**
 * OpenAI-compatible tool definition for persisting ranked clarification questions.
 */
export const SAVE_QUESTIONS_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: SAVE_QUESTIONS_TOOL_NAME,
    description:
      "Save the ranked clarification questions after analysis is complete.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "Ranked questions. Priority 1 is first. At most 8 items.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Stable id such as Q-001.",
              },
              priority: {
                type: "number",
                description: "Lower number is asked first.",
              },
              topic: {
                type: "string",
                description: "Short topic, for example roles or scope.",
              },
              question: {
                type: "string",
                description: "The question for the product owner.",
              },
              why: {
                type: "string",
                description: "Why this answer blocks an MVP spec.",
              },
              required: {
                type: "boolean",
                description: "True when the spec cannot proceed without an answer.",
              },
            },
            required: [
              "id",
              "priority",
              "topic",
              "question",
              "why",
              "required",
            ],
          },
        },
      },
      required: ["questions"],
    },
  },
};

/**
 * Reads and validates the questions payload from a save_questions tool call.
 *
 * @param rawArguments - JSON string supplied by the model.
 * @returns Parsed questions, or null when the payload is invalid.
 */
export function parseSaveQuestionsArgs(
  rawArguments: string,
): ClarificationQuestion[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("questions" in parsed) ||
    !Array.isArray(parsed.questions)
  ) {
    return null;
  }

  const questions: ClarificationQuestion[] = [];
  for (const item of parsed.questions) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const { id, priority, topic, question, why, required } = item as Record<
      string,
      unknown
    >;

    if (
      typeof id !== "string" ||
      !id.trim() ||
      typeof priority !== "number" ||
      typeof topic !== "string" ||
      !topic.trim() ||
      typeof question !== "string" ||
      !question.trim() ||
      typeof why !== "string" ||
      !why.trim() ||
      typeof required !== "boolean"
    ) {
      return null;
    }

    questions.push({
      id: id.trim(),
      priority,
      topic: topic.trim(),
      question: question.trim(),
      why: why.trim(),
      required,
    });
  }

  return questions.sort((a, b) => a.priority - b.priority);
}
