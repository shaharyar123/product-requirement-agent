import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateSpecRunDto } from "./dto/create-spec-run.dto";
import { RefinePrdDto } from "./dto/refine-prd.dto";
import { SubmitAnswersDto } from "./dto/submit-answers.dto";
import { PlanResult } from "./interfaces/plan-result.interface";
import { QuestionsResult } from "./interfaces/questions-result.interface";
import { RefineResult } from "./interfaces/refine-result.interface";
import { SpecRun } from "./interfaces/spec-run.interface";
import { SpecOrchestrator } from "./orchestrator/spec-orchestrator.service";
import { PlanningAgent } from "./planning.agent";
import { QuestionsAgent } from "./questions.agent";
import { RequirementsAgent } from "./requirements.agent";

/**
 * HTTP surface for Spec-stage agents and the run orchestrator.
 */
@Controller("spec")
export class SpecController {
  constructor(
    private readonly questions: QuestionsAgent,
    private readonly requirements: RequirementsAgent,
    private readonly planning: PlanningAgent,
    private readonly orchestrator: SpecOrchestrator,
  ) {}

  /**
   * Liveness probe for local and future frontend checks.
   */
  @Get("health")
  health(): { ok: true; agents: string[] } {
    return {
      ok: true,
      agents: ["questions", "requirements", "planning", "orchestrator"],
    };
  }

  /**
   * Starts a Spec run and pauses on required clarification questions.
   */
  @Post("runs")
  startRun(@Body() body: CreateSpecRunDto): Promise<SpecRun> {
    return this.orchestrator.start(body.prd, body.notifyTo);
  }

  /**
   * Returns the current run, including questions, answers, and artifacts.
   */
  @Get("runs/:id")
  getRun(@Param("id") id: string): SpecRun {
    return this.orchestrator.getRun(id);
  }

  /**
   * Submits clarification answers and continues to requirements + plan.
   */
  @Post("runs/:id/answers")
  submitAnswers(
    @Param("id") id: string,
    @Body() body: SubmitAnswersDto,
  ): Promise<SpecRun> {
    return this.orchestrator.submitAnswers(id, body.answers);
  }

  /**
   * Imports `Q-001: answer` replies from the Slack DM thread for this run.
   */
  @Post("runs/:id/slack-answers")
  async importSlackAnswers(
    @Param("id") id: string,
  ): Promise<{ answers: { id: string; answer: string }[] }> {
    const answers = await this.orchestrator.importSlackAnswers(id);
    return { answers };
  }

  /**
   * Runs the Question agent against a supplied or default PRD.
   */
  @Post("questions")
  ask(@Body() body: RefinePrdDto): Promise<QuestionsResult> {
    return this.questions.run(body.prd);
  }

  /**
   * Runs the Requirements agent against a supplied or default PRD.
   */
  @Post("refine")
  refine(@Body() body: RefinePrdDto): Promise<RefineResult> {
    return this.requirements.run(body.prd);
  }

  /**
   * Runs the Planning agent. Uses the last refine output when `prd` is omitted.
   */
  @Post("plan")
  plan(@Body() body: RefinePrdDto): Promise<PlanResult> {
    return this.planning.run(body.prd);
  }
}
