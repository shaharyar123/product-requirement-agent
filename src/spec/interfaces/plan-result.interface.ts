import { PlanArtifact } from "./plan-artifact.interface";

/**
 * Successful Planning agent run.
 */
export interface PlanResult {
  model: string;
  path: string;
  markdown: string;
  plan: PlanArtifact;
}
