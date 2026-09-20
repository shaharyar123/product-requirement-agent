import { ClarificationQuestion } from "./clarification-question.interface";

/**
 * Successful Question agent run.
 */
export interface QuestionsResult {
  model: string;
  path: string;
  markdown: string;
  questions: ClarificationQuestion[];
}
