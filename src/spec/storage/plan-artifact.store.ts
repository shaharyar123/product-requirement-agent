import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PlanArtifact } from "../interfaces/plan-artifact.interface";

/**
 * Persists the factory handoff plan as Markdown and JSON.
 */
@Injectable()
export class PlanArtifactStore {
  private readonly log = new Logger(PlanArtifactStore.name);
  private readonly markdownPath = join(process.cwd(), "output", "plan.md");
  private readonly jsonPath = join(process.cwd(), "output", "plan.json");

  /**
   * Writes both artifacts and returns the Markdown path.
   */
  async save(plan: PlanArtifact): Promise<string> {
    const markdown = this.toMarkdown(plan);
    await mkdir(join(process.cwd(), "output"), { recursive: true });
    await writeFile(this.markdownPath, markdown, "utf8");
    await writeFile(this.jsonPath, JSON.stringify(plan, null, 2), "utf8");
    this.log.log(`Saved ${this.markdownPath}`);
    return this.markdownPath;
  }

  /**
   * Renders the handoff packet for human review.
   */
  toMarkdown(plan: PlanArtifact): string {
    const lines = [
      "# Factory Handoff Plan",
      "",
      "## Summary",
      "",
      plan.summary,
      "",
      "## Epics",
      "",
    ];

    for (const epic of plan.epics) {
      lines.push(`- ${epic.id}: ${epic.title}`);
    }

    lines.push("", "## Stories", "");
    for (const story of plan.stories) {
      lines.push(`- ${story.id} (${story.epicId}): ${story.title}`);
      lines.push(`  - Acceptance: ${story.acceptance}`);
    }

    lines.push("", "## Design inputs", "");
    for (const input of plan.designInputs) {
      lines.push(`- ${input.id}: ${input.name} — ${input.notes}`);
    }

    lines.push("", "## Architecture inputs", "");
    for (const input of plan.architectureInputs) {
      lines.push(`- ${input.id}: ${input.capability}`);
    }

    lines.push("", "## Open questions", "");
    if (plan.openQuestions.length === 0) {
      lines.push("- None");
    } else {
      for (const item of plan.openQuestions) {
        lines.push(`- ${item.id}: ${item.question}`);
      }
    }

    lines.push("", "## Approval checklist", "");
    for (const item of plan.approvalChecklist) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push("");

    return lines.join("\n");
  }
}
