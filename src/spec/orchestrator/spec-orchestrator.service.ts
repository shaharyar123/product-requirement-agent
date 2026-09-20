import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ClarificationAnswer } from "../interfaces/clarification-answer.interface";
import { SpecRun } from "../interfaces/spec-run.interface";
import { PlanningAgent } from "../planning.agent";
import { QuestionsAgent } from "../questions.agent";
import { RequirementsAgent } from "../requirements.agent";
import { SlackNotifyService } from "../notify/slack-notify.service";
import { SpecRunStore } from "../runs/spec-run.store";

const DEFAULT_PRD_PATH = join(process.cwd(), "prd", "workboard.md");

/**
 * Spec-stage orchestrator: questions → human answers → requirements → plan.
 */
@Injectable()
export class SpecOrchestrator {
  private readonly log = new Logger(SpecOrchestrator.name);

  constructor(
    private readonly runs: SpecRunStore,
    private readonly questions: QuestionsAgent,
    private readonly requirements: RequirementsAgent,
    private readonly planning: PlanningAgent,
    private readonly slack: SlackNotifyService,
  ) {}

  getRun(id: string): SpecRun {
    return this.runs.get(id);
  }

  /**
   * Starts a run, generates questions, and pauses unless nothing is required.
   */
  async start(prdText?: string, notifyTo?: string): Promise<SpecRun> {
    const prd = await this.loadIntake(prdText);
    const now = new Date().toISOString();
    const run = this.runs.create({
      id: randomUUID(),
      status: "running",
      prd,
      notifyTo: notifyTo?.trim() || undefined,
      questions: [],
      answers: [],
      events: [],
      createdAt: now,
      updatedAt: now,
    });
    this.runs.addEvent(run, "run_started", "Spec run started");

    try {
      const asked = await this.questions.run(prd);
      run.questions = asked.questions;
      this.runs.addEvent(
        run,
        "questions_ready",
        `${asked.questions.length} clarification question(s)`,
      );

      const required = asked.questions.filter((item) => item.required);
      if (required.length === 0) {
        this.runs.addEvent(
          run,
          "gate_skipped",
          "No required questions; continuing to requirements",
        );
        await this.completeFromAnswers(run, []);
        return run;
      }

      run.status = "waiting_for_answers";
      this.runs.addEvent(
        run,
        "waiting_for_answers",
        "Human must answer required clarification questions",
      );
      await this.notifySlack(run);
      this.runs.save(run);
      if (run.slackChannel && run.slackMessageTs) {
        void this.watchSlackReplies(run.id);
      }
      return run;
    } catch (error) {
      this.fail(run, error);
      throw error;
    }
  }

  /**
   * Accepts answers, then runs requirements and planning.
   */
  async submitAnswers(
    id: string,
    answers: ClarificationAnswer[],
  ): Promise<SpecRun> {
    const run = this.runs.get(id);
    if (run.status !== "waiting_for_answers") {
      throw new ConflictException(
        `Run ${id} is ${run.status}, not waiting_for_answers.`,
      );
    }

    const validated = this.validateAnswers(run, answers);
    run.status = "running";
    this.runs.addEvent(run, "answers_received", `${validated.length} answer(s)`);

    try {
      await this.completeFromAnswers(run, validated);
      return run;
    } catch (error) {
      this.fail(run, error);
      throw error;
    }
  }

  private async completeFromAnswers(
    run: SpecRun,
    answers: ClarificationAnswer[],
  ): Promise<void> {
    run.answers = answers;
    this.runs.save(run);

    const refined = await this.requirements.run(run.prd, answers);
    run.requirementsMarkdown = refined.markdown;
    this.runs.addEvent(run, "requirements_saved", refined.path);

    try {
      const planned = await this.planning.run(refined.markdown);
      run.plan = planned.plan;
      run.planMarkdown = planned.markdown;
      this.runs.addEvent(run, "plan_saved", planned.path);
      run.status = "completed";
      this.runs.save(run);
      this.log.log(`Run ${run.id} completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run.error = message;
      run.status = "failed";
      this.runs.addEvent(run, "plan_failed", message);
      this.runs.save(run);
    }
  }

  private validateAnswers(
    run: SpecRun,
    answers: ClarificationAnswer[],
  ): ClarificationAnswer[] {
    const byId = new Map(
      answers.map((item) => [item.id, item.answer.trim()] as const),
    );
    const known = new Set(run.questions.map((item) => item.id));

    for (const id of byId.keys()) {
      if (!known.has(id)) {
        throw new BadRequestException(`Unknown question id ${id}.`);
      }
    }

    const validated: ClarificationAnswer[] = [];
    for (const question of run.questions) {
      const answer = byId.get(question.id) ?? "";
      if (question.required && !answer) {
        throw new BadRequestException(
          `Required question ${question.id} is missing an answer.`,
        );
      }
      if (answer) {
        validated.push({
          id: question.id,
          question: question.question,
          answer,
        });
      }
    }
    return validated;
  }

  /**
   * Reads Slack thread replies and returns parsed Q-id answers without completing the run.
   */
  async importSlackAnswers(id: string): Promise<ClarificationAnswer[]> {
    const run = this.runs.get(id);
    if (!run.slackChannel || !run.slackMessageTs) {
      throw new BadRequestException(
        "This run has no Slack thread. Start a run with notifyTo and a SLACK_BOT_TOKEN.",
      );
    }
    const answers = await this.slack.readAnswers(
      run.slackChannel,
      run.slackMessageTs,
    );
    this.runs.addEvent(
      run,
      "slack_replies_imported",
      `${answers.length} answer(s) from Slack`,
    );
    return answers;
  }

  private async notifySlack(run: SpecRun): Promise<void> {
    if (!run.notifyTo) {
      return;
    }
    if (!this.slack.isConfigured()) {
      this.runs.addEvent(
        run,
        "slack_skipped",
        "notifyTo set but SLACK_BOT_TOKEN is missing",
      );
      return;
    }
    try {
      const target = await this.slack.sendQuestions(
        run.id,
        run.notifyTo,
        run.questions,
      );
      run.slackChannel = target.channel;
      run.slackMessageTs = target.ts;
      this.runs.addEvent(
        run,
        "slack_sent",
        `Questions DMed to ${run.notifyTo}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.runs.addEvent(run, "slack_failed", message);
      this.log.warn(message);
    }
  }

  /**
   * Polls the Slack thread until required questions are answered, then continues.
   */
  private async watchSlackReplies(runId: string): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const run = this.runs.get(runId);
      if (run.status !== "waiting_for_answers") {
        return;
      }
      if (!run.slackChannel || !run.slackMessageTs) {
        return;
      }

      try {
        const answers = await this.slack.readAnswers(
          run.slackChannel,
          run.slackMessageTs,
        );
        if (!this.hasAllRequiredAnswers(run, answers)) {
          continue;
        }
        this.runs.addEvent(
          run,
          "slack_replies_imported",
          `${answers.length} answer(s) from Slack`,
        );
        await this.submitAnswers(runId, answers);
        return;
      } catch (error) {
        if (error instanceof ConflictException) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.runs.addEvent(run, "slack_watch_failed", message);
        this.log.warn(message);
        return;
      }
    }
  }

  private hasAllRequiredAnswers(
    run: SpecRun,
    answers: ClarificationAnswer[],
  ): boolean {
    const byId = new Map(
      answers.map((item) => [item.id.toUpperCase(), item.answer.trim()]),
    );
    return run.questions
      .filter((item) => item.required)
      .every((item) => Boolean(byId.get(item.id.toUpperCase())));
  }

  private async loadIntake(prdText?: string): Promise<string> {
    if (prdText?.trim()) {
      return prdText.trim();
    }
    const prd = (await readFile(DEFAULT_PRD_PATH, "utf8")).trim();
    if (!prd) {
      throw new BadRequestException("PRD is empty.");
    }
    return prd;
  }

  private fail(run: SpecRun, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    run.status = "failed";
    run.error = message;
    this.runs.addEvent(run, "run_failed", message);
    this.runs.save(run);
  }
}
