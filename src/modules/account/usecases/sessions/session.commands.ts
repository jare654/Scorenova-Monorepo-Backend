import { SessionEntity } from "@account/models/sessions/session.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
export class CreateSessionCommand {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_refresh_token" })
  refreshToken: string;
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_access_token" })
  @IsNotEmpty()
  token?: string;
  @ApiProperty({ example: "192.168.1.1" })
  ipAddress?: string;
  @ApiProperty({ example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })
  userAgent?: string;
  static fromCommand(command: CreateSessionCommand): SessionEntity {
    const sessionDomain = new SessionEntity();
    sessionDomain.accountId = command.accountId;
    sessionDomain.refreshToken = command.refreshToken;
    sessionDomain.token = command.token;
    sessionDomain.ipAddress = command.ipAddress;
    sessionDomain.userAgent = command.userAgent;
    return sessionDomain;
  }
}
export class UpdateSessionCommand {
  @ApiProperty({
    example: "d02dd06f-2a30-4ed8-a2a0-75c683e3092e",
  })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_refresh_token" })
  refreshToken: string;
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_access_token" })
  @IsNotEmpty()
  token: string;
  @ApiProperty({ example: "192.168.1.1" })
  ipAddress: string;
  @ApiProperty({ example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })
  userAgent: string;
}
