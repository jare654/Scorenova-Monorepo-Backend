import { IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserInfo } from "@account/auth/dtos/user-info.dto";

export class BulkUpdateCommand {
    @ApiProperty({
      example: "d02dd06f-2a30-4ed8-a2a0-75c683e3092e",
    })
    @IsNotEmpty()
    ids: string[];
    @ApiProperty()
    @IsNotEmpty()
    enabled: boolean;
    currentUser: UserInfo;
  }