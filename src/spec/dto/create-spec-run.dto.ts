import { IsOptional, IsString } from "class-validator";

/**
 * Starts a Spec pipeline run: questions, then pause for answers.
 */
export class CreateSpecRunDto {
  @IsOptional()
  @IsString()
  prd?: string;

  /** Slack email, @username, or member id (U…) to DM the questions. */
  @IsOptional()
  @IsString()
  notifyTo?: string;
}
