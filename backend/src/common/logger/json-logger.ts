import { LoggerService, Injectable } from '@nestjs/common';
import { requestContextStorage } from '../middleware/request-context.middleware';

@Injectable()
export class JsonLogger implements LoggerService {
  private print(level: string, message: any, context?: string, stack?: any) {
    const isProduction = process.env.NODE_ENV === 'production';
    const store = requestContextStorage.getStore();
    const requestId = store?.requestId || 'N/A';
    const cfRay = store?.cfRay || 'N/A';

    if (isProduction) {
      const logObject: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level,
        context: context || 'Application',
        requestId,
        cfRay,
      };

      if (typeof message === 'object' && message !== null) {
        Object.assign(logObject, message);
      } else {
        logObject.message = String(message);
      }

      if (stack) {
        logObject.stack = typeof stack === 'object' ? JSON.stringify(stack) : String(stack);
      }

      process.stdout.write(JSON.stringify(logObject) + '\n');
    } else {
      const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';
      const reset = '\x1b[0m';
      const time = new Date().toLocaleTimeString();
      const msgStr = typeof message === 'object' ? JSON.stringify(message) : message;
      console.log(`[${time}] ${color}${level.toUpperCase()}${reset} [${context || 'App'}] [ReqID: ${requestId}] [CF-Ray: ${cfRay}] ${msgStr}`);
      if (stack) console.error(stack);
    }
  }

  log(message: any, context?: string) {
    this.print('info', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    this.print('error', message, context, stack);
  }

  warn(message: any, context?: string) {
    this.print('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.print('debug', message, context);
  }

  verbose(message: any, context?: string) {
    this.print('verbose', message, context);
  }
}
