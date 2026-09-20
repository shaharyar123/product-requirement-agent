import { IsOptional, IsString } from "class-validator";

/**
 * Body for POST /spec/questions, POST /spec/refine, and POST /spec/plan.
 * When `prd` is omitted, questions/refine load WorkBoard; plan prefers
 * the last requirements.md if it exists.
 */
export class RefinePrdDto {
  @IsOptional()
  @IsString()
  prd?: string;
}
