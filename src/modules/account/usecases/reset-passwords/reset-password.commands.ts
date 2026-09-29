import { ResetPasswordTokenEntity } from "@account/models/reset-password/reset-password.entity";

export class CreateResetPasswordTokenCommand {
  token: string;
  email: string;
  accountId: string;
  type: string;
  static fromCommand(
    command: CreateResetPasswordTokenCommand
  ): ResetPasswordTokenEntity {
    const resetPasswordDomain = new ResetPasswordTokenEntity();
    resetPasswordDomain.token = command.token;
    resetPasswordDomain.email = command.email.toLowerCase();
    resetPasswordDomain.accountId = command.accountId;
    resetPasswordDomain.type = command.type;
    return resetPasswordDomain;
  }
}
