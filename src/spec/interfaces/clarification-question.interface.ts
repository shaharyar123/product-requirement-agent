/**
 * One clarification question the human must answer before requirements can be written.
 */
export interface ClarificationQuestion {
  /** Stable id such as Q-001. */
  id: string;
  /** 1 is asked first. */
  priority: number;
  /** Short topic label, for example roles or scope. */
  topic: string;
  /** The question shown to the product owner. */
  question: string;
  /** Why this answer blocks an MVP spec. */
  why: string;
  /** True when the Requirements agent cannot proceed without an answer. */
  required: boolean;
}
