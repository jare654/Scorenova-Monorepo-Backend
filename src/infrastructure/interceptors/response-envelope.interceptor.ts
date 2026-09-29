import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If data is an array, wrap it in a 'data' object.
        // Also ensure we don't double-wrap if it's already wrapped (like in paginated responses).
        if (Array.isArray(data)) {
          return { data };
        }
        return data;
      })
    );
  }
}
