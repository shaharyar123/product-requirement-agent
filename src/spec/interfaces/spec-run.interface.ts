import { ClarificationAnswer } from "./clarification-answer.interface";
import { ClarificationQuestion } from "./clarification-question.interface";
import { PlanArtifact } from "./plan-artifact.interface";

export type SpecRunStatus =
  | "running"
  | "waiting_for_answers"
  | "completed"
  | "failed";

export interface SpecRunEvent {
  at: string;
  type: string;
  message: string;
}

/**
 * One Spec-stage pipeline run.
 * ponytail: in-memory only; Postgres when UI needs history across restarts.
 */
export interface SpecRun {
  id: string;
  status: SpecRunStatus;
  prd: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  requirementsMarkdown?: string;
  plan?: PlanArtifact;
  planMarkdown?: string;
  notifyTo?: string;
  slackChannel?: string;
  slackMessageTs?: string;
  error?: string;
  events: SpecRunEvent[];
  createdAt: string;
  updatedAt: string;
}
