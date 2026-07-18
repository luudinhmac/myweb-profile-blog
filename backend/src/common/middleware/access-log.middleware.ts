import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContextStorage } from './request-context.middleware';

const sanitizeUrl = (url: string): string => {
  return url.replace(/(token|password|secret|jwt|code|accessToken)=([^&]+)/ig, '$1=***');
};

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
      const clientIp = (req as any).ip || req.headers['x-original-client-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const responseBytes = res.getHeader('content-length') || '_';

      // Bypass health check endpoints to reduce log noise
      if (originalUrl === '/api/health' || originalUrl === '/health') return;

      const sanitizedUrl = sanitizeUrl(originalUrl);

      this.logger.log({
        message: `${method} ${sanitizedUrl} - Status: ${res.statusCode} (${duration}ms)`,
        type: 'access',
        method,
        url: sanitizedUrl,
        status: res.statusCode,
        duration,
        ip: clientIp,
        bytes: responseBytes,
        userId,
      });
    });

    next();
  }
}
