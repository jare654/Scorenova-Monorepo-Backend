import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    let secret =
      configService.get<string>("JWT_SECRET") ||
      process.env.JWT_SECRET;
    const nodeEnv = configService.get<string>("NODE_ENV") ?? process.env.NODE_ENV;
    if (!secret && nodeEnv !== "production") {
      secret = "dev-jwt-secret-change-in-production-min-32-chars";
      console.warn(
        "[JwtStrategy] JWT_SECRET not set; using dev default. Set JWT_SECRET in .env for production."
      );
    }
    if (!secret) {
      throw new Error(
        "JWT_SECRET is required. Add it to .env (see .env.example)."
      );
    }
    const strategyOptions: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ["HS256"],
    };
    super(strategyOptions);
  }

  async validate(payload: any) {
    const { exp, iat, iss, nbf, sub, ...rest } = payload;
    return rest;
  }
}
