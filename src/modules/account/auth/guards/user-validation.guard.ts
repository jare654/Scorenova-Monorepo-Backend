import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EntityManager } from "typeorm";
import * as jwt from "jsonwebtoken";
import { ALLOW_ANONYMOUS_META_KEY } from "../decorators/allow-anonymous.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entityManager: EntityManager
  ) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isAnonymousAllowed =
      this.reflector?.get<boolean>(
        ALLOW_ANONYMOUS_META_KEY,
        context.getHandler()
      ) ||
      this.reflector?.get<boolean>(
        ALLOW_ANONYMOUS_META_KEY,
        context.getClass()
      );
    if (isAnonymousAllowed || isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token is missing or is invalid");
    }
    const token = authHeader.split(" ")[1];
    let decodedToken: jwt.JwtPayload & { id: string };
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UnauthorizedException("JWT secret is not configured");
      }
      decodedToken = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload & { id: string };
    } catch (err) {
      throw new UnauthorizedException("Invalid Token");
    }
    const currentUser = await this.entityManager.query(
      `SELECT * from accounts where id = $1`,
      [decodedToken.id]
    );
    if (!currentUser || currentUser.length === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: "User does not exist",
          data: { logout: true },
        },
        HttpStatus.FORBIDDEN
      );
    }
    const userRecord = currentUser[0];
    if (!userRecord.is_active) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: "User is inactive",
          data: { logout: true },
        },
        HttpStatus.FORBIDDEN
      );
    }
    if (userRecord.deleted_at) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: "User has been archived",
          data: { logout: true },
        },
        HttpStatus.FORBIDDEN
      );
    }
    request.currentUser = userRecord;
    return true;
  }
}
