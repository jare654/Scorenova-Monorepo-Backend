import { extractCurrentUser } from "@account/auth/utilities/extract-current-user";
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { ALLOW_ANONYMOUS_META_KEY } from "../decorators/allow-anonymous.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  
    const isAnonymousAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  
    if (isPublic || isAnonymousAllowed) {
      return true;
    }
  
    return super.canActivate(context);
  }
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext
  ) {
    if (!user) {
      throw err || new UnauthorizedException(info.message);
    }
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;
    const userInfo = extractCurrentUser(user, headers);

    if (err || !userInfo) {
      throw err || new UnauthorizedException(info.message);
    }

    return userInfo;
  }
}
