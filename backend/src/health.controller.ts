import { Controller, Get, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  private isPublicRequest(req: Request): boolean {
    const host = req.headers.host || '';
    const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
    const originalHost = (req.headers['x-original-host'] as string) || '';
    const hostname = req.hostname || '';

    return (
      host.includes('luumac.io.vn') ||
      forwardedHost.includes('luumac.io.vn') ||
      originalHost.includes('luumac.io.vn') ||
      hostname.includes('luumac.io.vn')
    );
  }

  @Get()
  @ApiOperation({ summary: 'Check system health status (Readiness)' })
  async check(@Req() req: Request, @Res() res: Response) {
    const state = this.healthService.getReadiness();
    const statusCode = state.status === 'ok' ? 200 : 503;

    const isCI = req.headers['x-ci-verify'] === 'true';
    if (this.isPublicRequest(req) && !isCI) {
      // Public access: sanitize response to prevent leakage
      return res.status(statusCode).json({
        status: state.status,
        database: state.database,
      });
    }

    // Internal/local access or CI request: return full details (including version for CI/CD)
    return res.status(statusCode).json(state);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe check' })
  async live(@Res() res: Response) {
    // Public access allowed: liveness only returns {"status":"ok","timestamp":"..."} which is safe
    return res.status(200).json(this.healthService.getLiveness());
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe check' })
  async ready(@Req() req: Request, @Res() res: Response) {
    if (this.isPublicRequest(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const state = this.healthService.getReadiness();
    const statusCode = state.status === 'ok' ? 200 : 503;
    return res.status(statusCode).json(state);
  }
}
