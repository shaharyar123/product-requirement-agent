import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type OpenAI from "openai";
import { PlanArtifact } from "./interfaces/plan-artifact.interface";
import { PlanResult } from "./interfaces/plan-result.interface";
import { GroqChatService } from "./llm/groq-chat.service";
import {
  buildPlanningUserPrompt,
  PLANNING_SYSTEM_PROMPT,
} from "./prompts/planning.prompt";
import { PlanArtifactStore } from "./storage/plan-artifact.store";
import {
  parseSavePlanArgs,
  SAVE_PLAN_TOOL,
  SAVE_PLAN_TOOL_NAME,
} from "./tools/save-plan.tool";

const DEFAULT_PRD_PATH = join(process.cwd(), "prd", "workboard.md");
const REQUIREMENTS_PATH = join(process.cwd(), "output", "requirements.md");
const MAX_AGENT_TURNS = 8;

/**
 * Spec-stage Planning agent.
 *
 * Turns a requirements artifact into a factory handoff packet
 * for later Design and Architecture stages.
 */
@Injectable()
export class PlanningAgent {
  private readonly log = new Logger(PlanningAgent.name);

  constructor(
    private readonly groq: GroqChatService,
    private readonly artifacts: PlanArtifactStore,
  ) {}

  /**
   * Runs one planning pass.
   *
   * @param prdText - Optional intake. Falls back to last refine output, then WorkBoard.
   */
  async run(prdText?: string): Promise<PlanResult> {
    const prd = await this.resolveIntake(prdText);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: PLANNING_SYSTEM_PROMPT },
      { role: "user", content: buildPlanningUserPrompt(prd) },
    ];

    let savedPath: string | undefined;
    let plan: PlanArtifact | undefined;
    let lastContent = "";

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
      this.log.log(`Turn ${turn + 1}/${MAX_AGENT_TURNS} (${this.groq.model})`);

      const message = await this.completeTurn(messages);
      messages.push(this.toAssistantMessage(message));
      if (message.content) {
        lastContent = message.content;
      }

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const fromText = this.planFromAssistantText(message.content);
        if (fromText) {
          savedPath = await this.artifacts.save(fromText);
          plan = fromText;
        }
        break;
      }

      for (const call of toolCalls) {
        const result = await this.executeToolCall(call);
        if (result.savedPath && result.plan) {
          savedPath = result.savedPath;
          plan = result.plan;
        } else {
          this.log.warn(result.toolResult);
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.toolResult,
        });
      }

      if (savedPath) {
        break;
      }
    }

    if (!savedPath || !plan) {
      const fromText = this.planFromAssistantText(lastContent);
      if (fromText) {
        savedPath = await this.artifacts.save(fromText);
        plan = fromText;
      }
    }

    if (!savedPath || !plan) {
      throw new InternalServerErrorException(
        "Agent finished without producing a factory handoff plan.",
      );
    }

    return {
      model: this.groq.model,
      path: savedPath,
      markdown: this.artifacts.toMarkdown(plan),
      plan,
    };
  }

  /**
   * Prefers request body, then the last Requirements artifact, then WorkBoard.
   */
  private async resolveIntake(prdText?: string): Promise<string> {
    if (prdText?.trim()) {
      return prdText.trim();
    }

    try {
      const requirements = (await readFile(REQUIREMENTS_PATH, "utf8")).trim();
      if (requirements) {
        this.log.log(`Using ${REQUIREMENTS_PATH} as planning intake`);
        return requirements;
      }
    } catch {
      // No prior refine output; fall through to the fixture.
    }

    const prd = (await readFile(DEFAULT_PRD_PATH, "utf8")).trim();
    if (!prd) {
      throw new BadRequestException("PRD is empty.");
    }
    return prd;
  }

  private async completeTurn(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): Promise<OpenAI.Chat.ChatCompletionMessage> {
    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await this.groq.createCompletion(
        messages,
        [SAVE_PLAN_TOOL],
        {
          type: "function",
          function: { name: SAVE_PLAN_TOOL_NAME },
        },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Groq request failed: ${detail}`);
    }

    const message = response.choices[0]?.message;
    if (!message) {
      throw new BadGatewayException("Groq returned an empty message.");
    }
    return message;
  }

  private toAssistantMessage(
    message: OpenAI.Chat.ChatCompletionMessage,
  ): OpenAI.Chat.ChatCompletionAssistantMessageParam {
    const assistant: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: message.content ?? null,
    };
    if (message.tool_calls?.length) {
      assistant.tool_calls = message.tool_calls;
    }
    return assistant;
  }

  private async executeToolCall(
    call: OpenAI.Chat.ChatCompletionMessageToolCall,
  ): Promise<{
    toolResult: string;
    savedPath?: string;
    plan?: PlanArtifact;
  }> {
    if (call.type !== "function") {
      return { toolResult: `Unsupported tool call type: ${call.type}` };
    }

    if (call.function.name !== SAVE_PLAN_TOOL_NAME) {
      return { toolResult: `Unknown tool: ${call.function.name}` };
    }

    const parsed = parseSavePlanArgs(call.function.arguments);
    if (!parsed) {
      return {
        toolResult:
          "save_plan JSON was invalid. Call save_plan again with summary, epics, stories, designInputs, architectureInputs, openQuestions, and approvalChecklist.",
      };
    }

    const savedPath = await this.artifacts.save(parsed);
    return {
      toolResult: `Plan saved to ${savedPath}`,
      savedPath,
      plan: parsed,
    };
  }

  /**
   * gpt-oss-20b often writes the plan as chat text instead of a tool call.
   */
  private planFromAssistantText(content: string | null): PlanArtifact | null {
    if (!content?.trim()) {
      return null;
    }
    const parsed = parseSavePlanArgs(content);
    if (parsed) {
      return parsed;
    }
    return {
      summary: content.trim().slice(0, 4000),
      epics: [],
      stories: [],
      designInputs: [],
      architectureInputs: [],
      openQuestions: [
        {
          id: "Q-PLAN-001",
          question:
            "Planning model returned prose instead of a structured handoff. Confirm epics and stories from the requirements artifact.",
        },
      ],
      approvalChecklist: [
        "Review the requirements artifact",
        "Rewrite the plan as structured epics and stories if needed",
      ],
    };
  }
}
