import { ApiProperty } from "@nestjs/swagger";

export class SubjectItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
}
