import type OpenAI from "openai";
import {
  PlanArchitectureInput,
  PlanArtifact,
  PlanDesignInput,
  PlanEpic,
  PlanOpenQuestion,
  PlanStory,
} from "../interfaces/plan-artifact.interface";

/** Tool name registered with the Groq/OpenAI chat completions API. */
export const SAVE_PLAN_TOOL_NAME = "save_plan";

/**
 * OpenAI-compatible tool definition for persisting the factory handoff packet.
 */
export const SAVE_PLAN_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: SAVE_PLAN_TOOL_NAME,
    description: "Save the factory handoff plan after analysis is complete.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Short product summary for later factory stages.",
        },
        epics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
            },
            required: ["id", "title"],
          },
        },
        stories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              epicId: { type: "string" },
              title: { type: "string" },
              acceptance: { type: "string" },
            },
            required: ["id", "epicId", "title", "acceptance"],
          },
        },
        designInputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              notes: { type: "string" },
            },
            required: ["id", "name", "notes"],
          },
        },
        architectureInputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              capability: { type: "string" },
            },
            required: ["id", "capability"],
          },
        },
        openQuestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
            },
            required: ["id", "question"],
          },
        },
        approvalChecklist: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "summary",
        "epics",
        "stories",
        "designInputs",
        "architectureInputs",
        "openQuestions",
        "approvalChecklist",
      ],
    },
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseEpics(value: unknown): PlanEpic[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const epics: PlanEpic[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const id = readString((item as { id?: unknown }).id);
    const title = readString((item as { title?: unknown }).title);
    if (id && title) {
      epics.push({ id, title });
    }
  }
  return epics;
}

function parseStories(value: unknown): PlanStory[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const stories: PlanStory[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const epicId = readString(record.epicId);
    const title = readString(record.title);
    const acceptance = readString(record.acceptance);
    if (id && epicId && title && acceptance) {
      stories.push({ id, epicId, title, acceptance });
    }
  }
  return stories;
}

function parseDesignInputs(value: unknown): PlanDesignInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const inputs: PlanDesignInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const name = readString(record.name);
    const notes = readString(record.notes);
    if (id && name && notes) {
      inputs.push({ id, name, notes });
    }
  }
  return inputs;
}

function parseArchitectureInputs(value: unknown): PlanArchitectureInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const inputs: PlanArchitectureInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const capability = readString(record.capability);
    if (id && capability) {
      inputs.push({ id, capability });
    }
  }
  return inputs;
}

function parseOpenQuestions(value: unknown): PlanOpenQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const questions: PlanOpenQuestion[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = readString(record.id);
    const question = readString(record.question);
    if (id && question) {
      questions.push({ id, question });
    }
  }
  return questions;
}

function parseChecklist(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: string[] = [];
  for (const item of value) {
    const text = readString(item);
    if (text) {
      items.push(text);
    }
  }
  return items;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const attempts = [candidate];
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(candidate.slice(start, end + 1));
  }

  for (const attempt of attempts) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Reads a plan payload from a tool call or from free-form model text.
 */
export function parseSavePlanArgs(rawArguments: string): PlanArtifact | null {
  const record = extractJsonObject(rawArguments);
  if (!record) {
    return null;
  }

  const summary =
    readString(record.summary) ??
    readString(record.productSummary) ??
    null;
  if (!summary) {
    return null;
  }

  return {
    summary,
    epics: parseEpics(record.epics),
    stories: parseStories(record.stories),
    designInputs: parseDesignInputs(record.designInputs),
    architectureInputs: parseArchitectureInputs(record.architectureInputs),
    openQuestions: parseOpenQuestions(record.openQuestions),
    approvalChecklist: parseChecklist(record.approvalChecklist),
  };
}
