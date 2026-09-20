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
import { ClarificationQuestion } from "./interfaces/clarification-question.interface";
import { QuestionsResult } from "./interfaces/questions-result.interface";
import { GroqChatService } from "./llm/groq-chat.service";
import {
  buildQuestionsUserPrompt,
  QUESTIONS_SYSTEM_PROMPT,
} from "./prompts/questions.prompt";
import { QuestionsArtifactStore } from "./storage/questions-artifact.store";
import {
  parseSaveQuestionsArgs,
  SAVE_QUESTIONS_TOOL,
  SAVE_QUESTIONS_TOOL_NAME,
} from "./tools/save-questions.tool";

/** Bundled sample PRD used when the request body does not include one. */
const DEFAULT_PRD_PATH = join(process.cwd(), "prd", "workboard.md");

/**
 * Upper bound on model ↔ tool round-trips for a single questions run.
 */
const MAX_AGENT_TURNS = 8;

/**
 * Spec-stage Question agent.
 *
 * Reads raw intake, asks Groq for ranked clarification questions,
 * and persists them through the save_questions tool.
 */
@Injectable()
export class QuestionsAgent {
  private readonly log = new Logger(QuestionsAgent.name);

  constructor(
    private readonly groq: GroqChatService,
    private readonly artifacts: QuestionsArtifactStore,
  ) {}

  /**
   * Runs one clarification pass.
   *
   * @param prdText - Optional intake body. Falls back to the WorkBoard fixture.
   */
  async run(prdText?: string): Promise<QuestionsResult> {
    const prd = await this.resolvePrd(prdText);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: buildQuestionsUserPrompt(prd) },
    ];

    let savedPath: string | undefined;
    let questions: ClarificationQuestion[] = [];

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
      this.log.log(`Turn ${turn + 1}/${MAX_AGENT_TURNS} (${this.groq.model})`);

      const message = await this.completeTurn(messages);
      messages.push(this.toAssistantMessage(message));

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        break;
      }

      for (const call of toolCalls) {
        const result = await this.executeToolCall(call);
        if (result.savedPath) {
          savedPath = result.savedPath;
          questions = result.questions ?? questions;
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

    if (!savedPath) {
      throw new InternalServerErrorException(
        "Agent finished without producing clarification questions.",
      );
    }

    return {
      model: this.groq.model,
      path: savedPath,
      markdown: this.artifacts.toMarkdown(questions),
      questions,
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
        SAVE_QUESTIONS_TOOL,
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
    questions?: ClarificationQuestion[];
  }> {
    if (call.type !== "function") {
      return { toolResult: `Unsupported tool call type: ${call.type}` };
    }

    if (call.function.name !== SAVE_QUESTIONS_TOOL_NAME) {
      return { toolResult: `Unknown tool: ${call.function.name}` };
    }

    const parsed = parseSaveQuestionsArgs(call.function.arguments);
    if (!parsed) {
      return {
        toolResult:
          "save_questions requires JSON with a questions array of valid items.",
      };
    }

    const savedPath = await this.artifacts.save(parsed);
    return {
      toolResult: `Questions saved to ${savedPath}`,
      savedPath,
      questions: parsed,
    };
  }
}
