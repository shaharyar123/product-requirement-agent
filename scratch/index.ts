import "dotenv/config";
import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

/**
 * ============================================
 * CONFIGURATION
 * ============================================
 */

const MODEL = "claude-sonnet-5";
const PRD_PATH = "./prd/workboard.md";
const OUTPUT_PATH = "./output/requirements.md";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * ============================================
 * TOOL DEFINITIONS
 * ============================================
 *
 * Claude can request this tool.
 *
 * Claude does NOT execute this function itself.
 * Our Node.js application executes it.
 */

const tools: Anthropic.Tool[] = [
  {
    name: "save_requirements",

    description:
      "Save the final product requirements document to the output file. " +
      "Use this tool after you have completely analyzed the PRD and " +
      "produced the final requirements document.",

    strict: true,

    input_schema: {
      type: "object",

      properties: {
        content: {
          type: "string",
          description:
            "The complete product requirements document in Markdown format.",
        },
      },

      required: ["content"],
    },
  },
];

/**
 * ============================================
 * TOOL IMPLEMENTATION
 * ============================================
 *
 * This is the actual code that runs when Claude
 * asks to use save_requirements.
 */

async function saveRequirements(content: string): Promise<string> {
  await fs.mkdir("./output", {
    recursive: true,
  });

  await fs.writeFile(
    OUTPUT_PATH,
    content,
    "utf-8"
  );

  return `Requirements successfully saved to ${OUTPUT_PATH}`;
}

/**
 * ============================================
 * TOOL EXECUTOR
 * ============================================
 *
 * Receives a tool call from Claude and decides
 * which local function should execute.
 */

async function executeTool(
  toolName: string,
  input: unknown
): Promise<string> {
  switch (toolName) {
    case "save_requirements": {
      const toolInput = input as {
        content: string;
      };

      return await saveRequirements(
        toolInput.content
      );
    }

    default:
      throw new Error(
        `Unknown tool requested by Claude: ${toolName}`
      );
  }
}

/**
 * ============================================
 * AGENT
 * ============================================
 */

async function runAgent(prd: string): Promise<void> {
  /**
   * Conversation history.
   *
   * We keep this because Claude may need multiple
   * rounds of:
   *
   * Claude → tool → result → Claude → tool → ...
   */
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",

      content: `
Analyze the following Product Requirements Document.

================ PRD START ================

${prd}

================= PRD END =================

Your task is to analyze the PRD and produce the
final MVP product requirements.

When your analysis is complete, use the
save_requirements tool to save the final
requirements document.
`,
    },
  ];

  /**
   * Agent loop
   *
   * Claude can:
   *
   * 1. Return a normal response
   * 2. Ask us to execute a tool
   *
   * If it asks for a tool, we execute it and
   * send the result back to Claude.
   */

  while (true) {
    console.log("\n→ Sending request to Claude...");

    const response = await client.messages.create({
      model: MODEL,

      max_tokens: 8000,

      system: `
You are a Product Requirements Agent.

Your responsibility is to analyze a software PRD
and turn it into clear, structured MVP product
requirements.

You must identify:

1. Product overview
2. Problem being solved
3. Target users
4. User roles
5. Core MVP features
6. User stories
7. Acceptance criteria
8. Business rules
9. Important constraints
10. Dependencies
11. Ambiguities
12. Missing requirements

IMPORTANT RULES:

- The PRD is the source of truth.
- Do not invent requirements.
- If something is unclear, explicitly identify it.
- If something is missing, identify it as a gap.
- Do not write application code.
- Do not design the technical architecture.
- Do not choose programming languages.
- Do not choose frameworks.
- Do not choose databases.
- Do not design APIs.
- Do not design infrastructure.
- Focus on WHAT the product must do.
- Do not focus on HOW it should be implemented.

The final requirements document should be clear
enough for a future Architecture Agent to use.

Once the requirements are complete, call the
save_requirements tool with the complete Markdown
document.

Do not call the tool until your requirements
analysis is complete.
`,

      tools,

      /**
       * Let Claude decide when to use the tool.
       */
      tool_choice: {
        type: "auto",
      },

      messages,
    });

    console.log(
      `Claude stop reason: ${response.stop_reason}`
    );

    /**
     * ============================================
     * HANDLE TOOL CALL
     * ============================================
     */

    if (response.stop_reason === "tool_use") {
      /**
       * IMPORTANT:
       *
       * We add Claude's response to the conversation
       * before sending the tool result back.
       */
      messages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      /**
       * Claude can theoretically request multiple
       * tools in one response, so we process every
       * tool_use block.
       */
      for (const block of response.content) {
        if (block.type !== "tool_use") {
          continue;
        }

        console.log(
          `\nClaude requested tool: ${block.name}`
        );

        console.log(
          "Tool input:",
          JSON.stringify(block.input, null, 2)
        );

        try {
          /**
           * Execute our local function.
           */
          const result = await executeTool(
            block.name,
            block.input
          );

          console.log(
            `Tool completed: ${block.name}`
          );

          /**
           * Send successful result back to Claude.
           */
          toolResults.push({
            type: "tool_result",

            tool_use_id: block.id,

            content: result,
          });
        } catch (error) {
          /**
           * If our tool fails, tell Claude about
           * the error instead of crashing the agent.
           */

          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          console.error(
            `Tool failed: ${errorMessage}`
          );

          toolResults.push({
            type: "tool_result",

            tool_use_id: block.id,

            content: `Tool execution failed: ${errorMessage}`,

            is_error: true,
          });
        }
      }

      /**
       * Add tool results to conversation.
       */
      messages.push({
        role: "user",

        content: toolResults,
      });

      /**
       * Go back to Claude.
       *
       * Claude now sees:
       *
       * - its previous response
       * - the tool result
       *
       * It can decide what to do next.
       */
      continue;
    }

    /**
     * ============================================
     * AGENT FINISHED
     * ============================================
     */

    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter(
          (
            block
          ): block is Anthropic.TextBlock =>
            block.type === "text"
        )
        .map((block) => block.text)
        .join("\n");

      console.log("\n");
      console.log("=================================");
      console.log("AGENT FINISHED");
      console.log("=================================");
      console.log("\n");

      if (finalText) {
        console.log(finalText);
      }

      return;
    }

    /**
     * ============================================
     * UNEXPECTED STOP
     * ============================================
     */

    throw new Error(
      `Claude stopped unexpectedly: ${response.stop_reason}`
    );
  }
}

/**
 * ============================================
 * MAIN
 * ============================================
 */

async function main(): Promise<void> {
  console.log("");
  console.log("=================================");
  console.log("     PRODUCT REQUIREMENTS AGENT");
  console.log("=================================");
  console.log("");

  /**
   * Check API key.
   */
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing.\n" +
        "Add it to your .env file."
    );
  }

  /**
   * Read the PRD from disk.
   */
  console.log(
    `Reading PRD: ${PRD_PATH}`
  );

  const prd = await fs.readFile(
    PRD_PATH,
    "utf-8"
  );

  if (!prd.trim()) {
    throw new Error(
      `PRD file is empty: ${PRD_PATH}`
    );
  }

  console.log(
    `PRD loaded (${prd.length} characters)`
  );

  /**
   * Run our agent.
   */
  await runAgent(prd);

  console.log("");
  console.log(
    `Output: ${OUTPUT_PATH}`
  );
  console.log("");
}

/**
 * ============================================
 * ERROR HANDLING
 * ============================================
 */

main().catch((error) => {
  console.error("");
  console.error("=================================");
  console.error("          AGENT FAILED");
  console.error("=================================");
  console.error("");

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
});