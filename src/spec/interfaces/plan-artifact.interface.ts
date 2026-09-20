/**
 * Factory handoff packet produced by the Planning agent.
 */
export interface PlanArtifact {
  summary: string;
  epics: PlanEpic[];
  stories: PlanStory[];
  designInputs: PlanDesignInput[];
  architectureInputs: PlanArchitectureInput[];
  openQuestions: PlanOpenQuestion[];
  approvalChecklist: string[];
}

export interface PlanEpic {
  id: string;
  title: string;
}

export interface PlanStory {
  id: string;
  epicId: string;
  title: string;
  acceptance: string;
}

export interface PlanDesignInput {
  id: string;
  name: string;
  notes: string;
}

export interface PlanArchitectureInput {
  id: string;
  capability: string;
}

export interface PlanOpenQuestion {
  id: string;
  question: string;
}
