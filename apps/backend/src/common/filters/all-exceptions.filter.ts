import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// API Contract §1.4/§13, Security Design §15: exactly one place in the
// application decides what an error response looks like on the wire.
// Unhandled exceptions are logged in full server-side (with a correlation
// id, once request-scoped logging is added — Phase 0 follow-up) and
// returned to the client as a generic, safe message. Never a stack trace,
// ORM error, or file path in the response body.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // ApiException already produces the { error: {...} } envelope;
      // Nest's built-in exceptions (e.g. from ValidationPipe) do not, so
      // they're normalized here rather than leaking Nest's default shape.
      const envelope =
        typeof body === 'object' && body !== null && 'error' in body
          ? body
          : { error: { code: 'VALIDATION_ERROR', message: this.flattenMessage(body) } };
      response.status(status).json(envelope);
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: "Something went wrong on our end. Your data wasn't changed. Try again in a moment.",
      },
    });
  }

  private flattenMessage(body: unknown): string {
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const m = (body as { message: unknown }).message;
      return Array.isArray(m) ? m.join(' ') : String(m);
    }
    return 'Request could not be processed.';
  }
}
