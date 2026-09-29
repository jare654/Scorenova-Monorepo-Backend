import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class UpdateSettingsDto {
  @ApiProperty({
    type: Object,
    example: {
      freeSubjectId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      monthlyPriceEtb: 150,
      annualPriceEtb: 1200,
    },
  })
  @IsObject()
  data: Record<string, any>;
}
