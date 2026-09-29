import { CreateSessionCommand } from "./session.commands";
import { SessionResponse } from "./session.response";
import { Injectable, NotFoundException } from "@nestjs/common";
import { SessionRepository } from "@account/models/sessions/session.repository";
import { OnEvent } from "@nestjs/event-emitter";
import * as crypto from "crypto";
@Injectable()
export class SessionCommands {
  constructor(private sessionRepository: SessionRepository) {}

  private hashRefreshToken(refreshToken: string): string {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  @OnEvent("create-session")
  async createSession(command: CreateSessionCommand): Promise<SessionResponse> {
    command.refreshToken = this.hashRefreshToken(command.refreshToken);
    const sessionDomain = CreateSessionCommand.fromCommand(command);
    const session = await this.sessionRepository.insert(sessionDomain);
    return SessionResponse.fromEntity(session);
  }
  async deleteSessionByToken(token: string): Promise<void> {
    const sessionDomain = await this.sessionRepository.getOneBy(
      "token",
      token,
      [],
      true
    );
    if (sessionDomain) {
      await this.sessionRepository.archive(sessionDomain.id);
    }
  }
  async deleteSessionByRefreshToken(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const sessionDomain = await this.sessionRepository.getOneBy(
      "refreshToken",
      refreshTokenHash,
      [],
      true
    );
    if (sessionDomain) {
      await this.sessionRepository.archive(sessionDomain.id);
    }
  }

  async revokeAllSessionsByAccountId(accountId: string): Promise<void> {
    const sessions = await this.sessionRepository.getAllBy(
      "accountId",
      accountId,
      [],
      true,
    );
    await Promise.all(
      sessions.map((session) => this.sessionRepository.archive(session.id)),
    );
  }
}
