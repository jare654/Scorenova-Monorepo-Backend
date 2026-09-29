import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { AccountRegistrationStatus } from "@account/models/accounts/account.entity";

export type RegistrationNextStep = "personal_details" | "set_password";

export interface RegistrationStagePayload {
  accountId: string;
  phoneNumber: string;
  status: AccountRegistrationStatus;
  nextStep: RegistrationNextStep;
}

@Injectable()
export class RegistrationStageTokenService {
  private getSecret(): string {
    const secret = process.env.REGISTRATION_STAGE_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("REGISTRATION_STAGE_SECRET or JWT_SECRET is not configured");
    }
    return secret;
  }

  sign(payload: RegistrationStagePayload, expiresIn: jwt.SignOptions["expiresIn"] = "10m"): string {
    return jwt.sign(
      {
        purpose: "registration-stage",
        ...payload,
      },
      this.getSecret(),
      {
        expiresIn,
        algorithm: "HS256",
      },
    );
  }

  verify(token: string): RegistrationStagePayload & { purpose: string } {
    try {
      const decoded = jwt.verify(token, this.getSecret(), {
        algorithms: ["HS256"],
      }) as RegistrationStagePayload & { purpose?: string };
      if (decoded.purpose !== "registration-stage") {
        throw new UnauthorizedException("Invalid registration token");
      }
      return decoded as RegistrationStagePayload & { purpose: string };
    } catch {
      throw new UnauthorizedException("Invalid or expired registration token");
    }
  }
}
