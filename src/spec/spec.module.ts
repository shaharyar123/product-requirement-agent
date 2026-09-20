import { Module } from "@nestjs/common";
import { GroqChatService } from "./llm/groq-chat.service";
import { SlackNotifyService } from "./notify/slack-notify.service";
import { SpecOrchestrator } from "./orchestrator/spec-orchestrator.service";
import { PlanningAgent } from "./planning.agent";
import { QuestionsAgent } from "./questions.agent";
import { RequirementsAgent } from "./requirements.agent";
import { SpecRunStore } from "./runs/spec-run.store";
import { SpecController } from "./spec.controller";
import { PlanArtifactStore } from "./storage/plan-artifact.store";
import { QuestionsArtifactStore } from "./storage/questions-artifact.store";
import { RequirementsArtifactStore } from "./storage/requirements-artifact.store";

/**
 * Spec-stage module: specialist agents plus the questions → answers → plan loop.
 */
@Module({
  controllers: [SpecController],
  providers: [
    GroqChatService,
    QuestionsAgent,
    QuestionsArtifactStore,
    RequirementsAgent,
    RequirementsArtifactStore,
    PlanningAgent,
    PlanArtifactStore,
    SpecRunStore,
    SlackNotifyService,
    SpecOrchestrator,
  ],
})
export class SpecModule {}
