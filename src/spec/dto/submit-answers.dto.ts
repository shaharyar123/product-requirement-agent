import { Type } from "class-transformer";
import { IsArray, IsString, ValidateNested } from "class-validator";

export class ClarificationAnswerDto {
  @IsString()
  id: string;

  @IsString()
  answer: string;
}

/**
 * Resumes a Spec run that is waiting for clarification answers.
 */
export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClarificationAnswerDto)
  answers: ClarificationAnswerDto[];
}
