import { Injectable } from "@nestjs/common";
import { ResetPasswordTokenRepository } from "@account/models/reset-password/reset-password.repository";
import { CreateResetPasswordTokenCommand } from "./reset-password.commands";
import { ResetPasswordTokenEntity } from "@account/models/reset-password/reset-password.entity";
@Injectable()
export class ResetPasswordTokenCommands {
  constructor(
    private resetPasswordTokenRepository: ResetPasswordTokenRepository
  ) {}
  async createResetPasswordToken(
    command: CreateResetPasswordTokenCommand
  ): Promise<ResetPasswordTokenEntity> {
    const resetPasswordTokenDomain =
      CreateResetPasswordTokenCommand.fromCommand(command);
    return await this.resetPasswordTokenRepository.insert(
      resetPasswordTokenDomain
    );
  }
  async deleteResetPasswordToken(accountId: string): Promise<boolean> {
    return await this.resetPasswordTokenRepository.delete(accountId);
  }
}
