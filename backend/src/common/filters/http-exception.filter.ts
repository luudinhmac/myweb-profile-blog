import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { requestContextStorage } from '../middleware/request-context.middleware';

const BOT_SCAN_PATTERNS = [
  /^\/\.env(\..*)?$/,
  /^\/\.git(\/.*)?$/,
  /^\/\.aws(\/.*)?$/,
  /^\/wp-admin(\/.*)?$/,
  /^\/wp-login\.php$/,
  /^\/phpmyadmin(\/.*)?$/,
  /^\/vendor(\/.*)?$/,
  /^\/actuator(\/.*)?$/,
  /^\/server-status(\/.*)?$/,
  /^\/graphql$/,
  /^\/swagger-ui(\/.*)?$/,
];

const logDampeningCache = new Map<string, number>();
const DAMPENING_PERIOD_MS = 60000;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Map domain errors to HTTP errors
    if (
      exception instanceof Error &&
      exception.name === 'PostNotFoundException'
    ) {
      status = HttpStatus.NOT_FOUND;
    }

    // Extract error message and map custom error code
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        message = resBody;
      } else if (typeof resBody === 'object' && resBody !== null) {
        message = (resBody as any).message || exception.message || 'Error';
      }

      // Map status codes to descriptive error codes
      if (status === HttpStatus.UNAUTHORIZED) {
        errorCode = 'UNAUTHORIZED';
      } else if (status === HttpStatus.NOT_FOUND) {
        errorCode = 'NOT_FOUND';
      } else if (status === HttpStatus.FORBIDDEN) {
        errorCode = 'FORBIDDEN';
      } else if (status >= 400 && status < 500) {
        errorCode = 'BAD_REQUEST';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if (exception.name === 'PostNotFoundException') {
        errorCode = 'NOT_FOUND';
      }
    }

    const errorResponse = {
      message: message,
      code: errorCode,
      status: status,
      timestamp: new Date().toISOString(),
      path: (request as any).url,
    };

    // Tách path sạch để test regex, giữ url đầy đủ để log
    const requestPath = (request as any).path || '';
    const requestUrl = (request as any).url || '';
    const clientIp = (request as any).ip || (request as any).headers?.['x-original-client-ip'] || (request as any).headers?.['x-forwarded-for'] || '';

    const isBotScan = status === HttpStatus.NOT_FOUND && 
      BOT_SCAN_PATTERNS.some(regex => regex.test(requestPath));

    const context = requestContextStorage.getStore();
    const requestId = context?.requestId || 'N/A';
    const cfRay = context?.cfRay || 'N/A';

    // Log the error
    if (status >= 500) {
      this.logger.error(
        `[ReqID: ${requestId}] [CF-Ray: ${cfRay}] ${(request as any).method} ${requestUrl} ${status} - Error: ${
          exception instanceof Error ? exception.message : 'Unknown error'
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (isBotScan) {
      // Rate-limit log INFO cho bot scan
      const cacheKey = `${clientIp}:${requestPath}`;
      const now = Date.now();
      const lastLogged = logDampeningCache.get(cacheKey);

      if (!lastLogged || (now - lastLogged > DAMPENING_PERIOD_MS)) {
        this.logger.log(
          `[ReqID: ${requestId}] [CF-Ray: ${cfRay}] [BotScan] ${(request as any).method} ${requestUrl} ${status} - Ignored (Rate-limited)`
        );
        logDampeningCache.set(cacheKey, now);

        if (logDampeningCache.size > 1000) {
          const oldestKey = logDampeningCache.keys().next().value;
          logDampeningCache.delete(oldestKey);
        }
      }
    } else {
      this.logger.warn(
        `[ReqID: ${requestId}] [CF-Ray: ${cfRay}] ${(request as any).method} ${requestUrl} ${status} - ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
