import { ApiProperty } from "@nestjs/swagger";

export class ExplainResponseDto {
  @ApiProperty({
    description: "Step-by-step explanation of how to reach the correct answer",
  })
  stepByStep: string;

  @ApiProperty({
    description: "Clear, concise explanation of the correct answer",
  })
  clear: string;

  @ApiProperty({
    description: "Simplified explanation suitable for quick understanding",
  })
  simplified: string;
}
