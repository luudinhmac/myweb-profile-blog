import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check system health status (Readiness)' })
  async check(@Res() res: Response) {
    const state = this.healthService.getReadiness();
    const statusCode = state.status === 'ok' ? 200 : 503;
    return res.status(statusCode).json(state);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe check' })
  async live(@Res() res: Response) {
    return res.status(200).json(this.healthService.getLiveness());
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe check' })
  async ready(@Res() res: Response) {
    const state = this.healthService.getReadiness();
    const statusCode = state.status === 'ok' ? 200 : 503;
    return res.status(statusCode).json(state);
  }
}
