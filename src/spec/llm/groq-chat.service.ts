import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

/** Default Groq OpenAI-compatible endpoint. */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Free-tier Groq model used when GROQ_MODEL is unset. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

/** Sampling temperature for deterministic requirements extraction. */
export const GROQ_TEMPERATURE = 0.2;

/**
 * Completion budget for a single Requirements agent turn.
 * Groq free-tier TPM is 8000 for gpt-oss-20b and counts prompt + max_tokens,
 * so 8192 alone already overflows the limit.
 */
export const GROQ_MAX_TOKENS = 4096;

/**
 * Thin Groq chat client. The Requirements agent depends on this service
 * instead of constructing the OpenAI SDK itself.
 */
@Injectable()
export class GroqChatService {
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService) {}

  /**
   * Model id sent to Groq for this process.
   */
  get model(): string {
    return this.config.get<string>("GROQ_MODEL") ?? DEFAULT_GROQ_MODEL;
  }

  /**
   * Runs one chat-completions turn with optional tool definitions.
   *
   * @param messages - Full conversation so far, including tool results.
   * @param tools - Tools the model may call.
   * @param toolChoice - `auto` by default; pass a named function to force a tool.
   */
  createCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    toolChoice: OpenAI.Chat.ChatCompletionToolChoiceOption = "auto",
  ): Promise<OpenAI.Chat.ChatCompletion> {
    return this.getClient().chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: GROQ_TEMPERATURE,
      max_tokens: GROQ_MAX_TOKENS,
    });
  }

  /**
   * Creates the SDK client on first use so /spec/health can run without a key.
   */
  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.config.get<string>("GROQ_API_KEY");
    if (!apiKey) {
      throw new InternalServerErrorException(
        "GROQ_API_KEY is missing. Add it to your .env file.",
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>("GROQ_BASE_URL") ?? GROQ_BASE_URL,
    });
    return this.client;
  }
}
