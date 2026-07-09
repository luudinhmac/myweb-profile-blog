import { Controller, Get, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InfrastructureConfigService } from './infrastructure/config/config.service';
import * as Minio from 'minio';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: InfrastructureConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check system health status' })
  async check(@Res() res: Response) {
    let dbStatus = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }

    let redisError: string | undefined = undefined;
    let redisStatus = 'connected';
    try {
      // Set temporary ping key to verify Redis connection
      await this.cache.set('healthcheck_ping', 'pong', 1000);
      const val = await this.cache.get('healthcheck_ping');
      if (val !== 'pong') {
        redisStatus = 'disconnected';
        redisError = `Expected pong, got ${String(val)}`;
      }
    } catch (error) {
      redisStatus = 'disconnected';
      redisError = error instanceof Error ? error.message : String(error);
    }

    let storageError: string | undefined = undefined;
    let storageStatus = 'connected';
    if (this.config.storageType === 'minio') {
      try {
        const client = new Minio.Client({
          endPoint: this.config.minioEndpoint,
          port: this.config.minioPort,
          useSSL: this.config.minioUseSSL,
          accessKey: this.config.minioAccessKey,
          secretKey: this.config.minioSecretKey,
        });
        await client.bucketExists(this.config.minioBucket);
      } catch (error) {
        storageStatus = 'disconnected';
        storageError = error instanceof Error ? error.message : String(error);
      }
    } else {
      storageStatus = 'local';
    }

    const isHealthy =
      dbStatus === 'connected' &&
      redisStatus === 'connected' &&
      (storageStatus === 'connected' || storageStatus === 'local');

    // Always return HTTP 200 to prevent Kubernetes liveness/readiness probe restarts,
    // allowing degraded states (e.g. temporary Redis/MinIO disconnects) to be resolved without container kills.
    // The smoke test will still inspect the JSON response body and verify if status is 'ok'.
    const status = 200;

    return res.status(status).json({
      status: isHealthy ? 'ok' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
      redisError,
      storage: storageStatus,
      storageError,
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
    });
  }
}
