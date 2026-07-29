import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  cfRay?: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

const isValidRequestId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9\-_.]+$/.test(id);

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingRequestId = req.headers['x-request-id'];
    const requestId = isValidRequestId(incomingRequestId) ? incomingRequestId : randomUUID();

    const incomingCfRay = req.headers['cf-ray'];
    const cfRay = isValidRequestId(incomingCfRay) ? incomingCfRay : undefined;

    res.setHeader('X-Request-ID', requestId);
    if (cfRay) res.setHeader('cf-ray', cfRay); // Thống nhất tên header

    requestContextStorage.run({ requestId, cfRay }, () => {
      next();
    });
  }
}
