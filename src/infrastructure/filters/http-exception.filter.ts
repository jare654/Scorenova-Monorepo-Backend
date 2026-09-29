import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  redactObject,
  sanitizeErrorMessage,
} from "@infrastructure/security/redaction.util";

interface IError {
  message: string;
  code_error: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request: any = ctx.getRequest();

    const rawMessage =
      exception instanceof Error
        ? exception.message
        : typeof exception === "string"
        ? exception
        : "";

    const isTimeout =
      exception?.name === "RequestTimeoutException" ||
      exception?.name === "GatewayTimeoutException" ||
      exception?.name === "TimeoutError" ||
      /timeout|etimedout|econnreset|socket hang up/i.test(rawMessage);

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isTimeout
        ? HttpStatus.REQUEST_TIMEOUT
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = process.env.NODE_ENV === "production";
    let message: any;
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === "string") {
        message = { message: resp, code_error: null };
      } else if (typeof resp === "object" && resp !== null) {
        message = resp;
      } else {
        message = { message: rawMessage, code_error: null };
      }

      // If status >= 500, never leak technical internal exception details to client
      if (status >= 500) {
        message = {
          message: "An unexpected server error occurred. Please try again later.",
          code_error: "INTERNAL_SERVER_ERROR",
        };
      }
    } else if (isTimeout) {
      message = {
        message: "The request timed out. Please check your connection and try again.",
        code_error: "REQUEST_TIMEOUT",
      };
    } else {
      message = {
        message: isProduction
          ? "An unexpected server error occurred. Please try again later."
          : (rawMessage || "An unexpected server error occurred. Please try again later."),
        code_error: "INTERNAL_SERVER_ERROR",
        ...(!isProduction && rawMessage ? { detail: rawMessage } : {}),
      };
    }

    const responseData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === "object" ? message : { message }),
    };

    this.logMessage(request, message, status, exception);

    response.status(status).json(responseData);
  }

  private logMessage(
    request: any,
    message: IError,
    status: number,
    exception: any
  ) {
    const rawMsg = typeof message === "string" ? message : message?.message || "Error occurred";
    const safeMessage = sanitizeErrorMessage(rawMsg);
    const codeError = message?.code_error ? message.code_error : null;
    const path = request?.path || request?.url || "unknown";
    const method = request?.method || "GET";

    const logLine = `[Request Error] ${method} ${path} -> Status: ${status} | Issue: ${safeMessage}${codeError ? ` (${codeError})` : ""}`;

    if (status >= 500) {
      console.error(logLine, exception?.stack ? `\nStack: ${exception.stack}` : "");
    } else {
      console.warn(logLine);
    }
  }
}
