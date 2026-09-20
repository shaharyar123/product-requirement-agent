import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ClarificationQuestion } from "../interfaces/clarification-question.interface";

/**
 * Persists clarification questions as Markdown and JSON.
 */
@Injectable()
export class QuestionsArtifactStore {
  private readonly log = new Logger(QuestionsArtifactStore.name);
  private readonly markdownPath = join(process.cwd(), "output", "questions.md");
  private readonly jsonPath = join(process.cwd(), "output", "questions.json");

  /**
   * Writes both artifacts and returns the Markdown path.
   *
   * @param questions - Ranked clarification questions.
   */
  async save(questions: ClarificationQuestion[]): Promise<string> {
    const markdown = this.toMarkdown(questions);
    await mkdir(join(process.cwd(), "output"), { recursive: true });
    await writeFile(this.markdownPath, markdown, "utf8");
    await writeFile(
      this.jsonPath,
      JSON.stringify(questions, null, 2),
      "utf8",
    );
    this.log.log(`Saved ${this.markdownPath}`);
    return this.markdownPath;
  }

  /**
   * Renders questions for human review.
   */
  toMarkdown(questions: ClarificationQuestion[]): string {
    if (questions.length === 0) {
      return "# Clarification Questions\n\nNo blocking questions. Intake is specific enough for the Requirements agent.\n";
    }

    const lines = ["# Clarification Questions", ""];
    for (const item of questions) {
      lines.push(`## ${item.id} — ${item.topic} (priority ${item.priority})`);
      lines.push("");
      lines.push(item.required ? "- Required: yes" : "- Required: no");
      lines.push(`- Question: ${item.question}`);
      lines.push(`- Why it blocks: ${item.why}`);
      lines.push("");
    }
    return lines.join("\n");
  }
}
