import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContextStorage } from './request-context.middleware';

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AccessLog');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const store = requestContextStorage.getStore();
      
      const requestId = store?.requestId || 'N/A';
      const cfRay = store?.cfRay || 'N/A';
      const userId = (req as any).user?.id || store?.userId || 'anonymous';

      // Bypass health check endpoints to reduce log noise
      if (originalUrl === '/api/health' || originalUrl === '/health') return;

      this.logger.log(
        `[ReqID: ${requestId}] [CF-Ray: ${cfRay}] [User: ${userId}] ${method} ${originalUrl} - Status: ${res.statusCode} (${duration}ms)`
      );
    });

    next();
  }
}
