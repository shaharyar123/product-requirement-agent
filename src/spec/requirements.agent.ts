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
import { RefineResult } from "./interfaces/refine-result.interface";
import { ClarificationAnswer } from "./interfaces/clarification-answer.interface";
import { GroqChatService } from "./llm/groq-chat.service";
import {
  buildRequirementsUserPrompt,
  REQUIREMENTS_SYSTEM_PROMPT,
} from "./prompts/requirements.prompt";
import { RequirementsArtifactStore } from "./storage/requirements-artifact.store";
import {
  parseSaveRequirementsArgs,
  SAVE_REQUIREMENTS_TOOL,
  SAVE_REQUIREMENTS_TOOL_NAME,
} from "./tools/save-requirements.tool";

/** Bundled sample PRD used when the request body does not include one. */
const DEFAULT_PRD_PATH = join(process.cwd(), "prd", "workboard.md");

/**
 * Upper bound on model ↔ tool round-trips for a single refine run.
 * Prevents an unbounded loop if the model keeps requesting tools.
 */
const MAX_AGENT_TURNS = 8;

/**
 * Spec-stage Requirements agent.
 *
 * Reads a raw PRD, asks Groq to extract structured MVP requirements,
 * and persists the result through the save_requirements tool.
 */
@Injectable()
export class RequirementsAgent {
  private readonly log = new Logger(RequirementsAgent.name);

  constructor(
    private readonly groq: GroqChatService,
    private readonly artifacts: RequirementsArtifactStore,
  ) {}

  /**
   * Runs one refinement pass.
   *
   * @param prdText - Optional PRD body. Falls back to the WorkBoard fixture.
   * @param answers - Optional clarification answers from the orchestrator gate.
   * @returns Model id, output path, and refined Markdown.
   */
  async run(
    prdText?: string,
    answers: ClarificationAnswer[] = [],
  ): Promise<RefineResult> {
    const prd = await this.resolvePrd(prdText);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: REQUIREMENTS_SYSTEM_PROMPT },
      { role: "user", content: buildRequirementsUserPrompt(prd, answers) },
    ];

    let savedPath: string | undefined;
    let markdown = "";

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
      this.log.log(`Turn ${turn + 1}/${MAX_AGENT_TURNS} (${this.groq.model})`);

      const message = await this.completeTurn(messages);
      messages.push(this.toAssistantMessage(message));

      if (message.content) {
        markdown = message.content;
      }

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        if (!savedPath && markdown) {
          savedPath = await this.artifacts.save(markdown);
        }
        break;
      }

      for (const call of toolCalls) {
        const result = await this.executeToolCall(call);
        if (result.savedPath) {
          savedPath = result.savedPath;
          markdown = result.markdown ?? markdown;
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.toolResult,
        });
      }

      // save_requirements is terminal. A follow-up turn would resend the full
      // document in tool_call arguments and exceed Groq's free-tier TPM.
      if (savedPath) {
        break;
      }
    }

    if (!savedPath) {
      throw new InternalServerErrorException(
        "Agent finished without producing requirements.",
      );
    }

    return {
      model: this.groq.model,
      path: savedPath,
      markdown,
    };
  }

  /**
   * Uses the request body when present; otherwise loads the default fixture.
   */
  private async resolvePrd(prdText?: string): Promise<string> {
    const prd = (prdText ?? (await readFile(DEFAULT_PRD_PATH, "utf8"))).trim();
    if (!prd) {
      throw new BadRequestException("PRD is empty.");
    }
    return prd;
  }

  /**
   * Calls Groq and returns the assistant message for this turn.
   */
  private async completeTurn(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): Promise<OpenAI.Chat.ChatCompletionMessage> {
    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await this.groq.createCompletion(messages, [
        SAVE_REQUIREMENTS_TOOL,
      ]);
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

  /**
   * Copies only the fields Groq accepts on the next request.
   * Extra SDK fields on the raw response are dropped.
   */
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

  /**
   * Executes a single tool call from the model.
   */
  private async executeToolCall(
    call: OpenAI.Chat.ChatCompletionMessageToolCall,
  ): Promise<{
    toolResult: string;
    savedPath?: string;
    markdown?: string;
  }> {
    if (call.type !== "function") {
      return { toolResult: `Unsupported tool call type: ${call.type}` };
    }

    if (call.function.name !== SAVE_REQUIREMENTS_TOOL_NAME) {
      return { toolResult: `Unknown tool: ${call.function.name}` };
    }

    const content = parseSaveRequirementsArgs(call.function.arguments);
    if (!content) {
      return {
        toolResult:
          "save_requirements requires JSON with a non-empty content string.",
      };
    }

    const savedPath = await this.artifacts.save(content);
    return {
      toolResult: `Requirements saved to ${savedPath}`,
      savedPath,
      markdown: content,
    };
  }
}
