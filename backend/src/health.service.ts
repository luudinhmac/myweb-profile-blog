import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MinioStorageService } from './infrastructure/storage/minio.storage';

export interface HealthState {
  status: 'starting' | 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  redisError?: string;
  storage: 'connected' | 'disconnected' | 'local';
  storageError?: string;
  checkedAt: string;
  lastSuccess?: string;
  lastFailure?: string;
  durationMs: number;
  consecutiveFailures: number;
  version: string;
}

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private isChecking = false;

  private state: HealthState = {
    status: 'starting',
    database: 'disconnected',
    redis: 'disconnected',
    storage: 'local',
    checkedAt: new Date().toISOString(),
    consecutiveFailures: 0,
    durationMs: 0,
    version: process.env.VERSION || '1.0.0',
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly minio: MinioStorageService,
  ) {}

  async onModuleInit() {
    // Run initial health check on startup
    await this.runHealthCheck();
  }

  getLiveness() {
    // Liveness probe only checks if NestJS process is running
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  getReadiness(): HealthState {
    return this.state;
  }

  @Interval(15000)
  async handleInterval() {
    await this.runHealthCheck();
  }

  private async runHealthCheck() {
    if (this.isChecking) {
      this.logger.warn(
        'Previous health check is still running. Skipping this cycle to prevent overlap.',
      );
      return;
    }

    this.isChecking = true;
    const startTime = Date.now();

    // Timeout helper function
    const withTimeout = <T>(
      promise: Promise<T>,
      timeoutMs: number,
      errorMessage: string,
    ): Promise<T> => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() =>
        clearTimeout(timer),
      );
    };

    // Prepare dependency checks running in parallel with 5s timeout
    const dbCheck = withTimeout(
      this.prisma.$queryRaw`SELECT 1`.then(() => 'connected' as const),
      5000,
      'Postgres connection timeout (5s)',
    );

    const redisCheck = withTimeout(
      (async () => {
        await this.cache.set('healthcheck_ping', 'pong', 1000);
        const val = await this.cache.get('healthcheck_ping');
        if (val !== 'pong')
          throw new Error(`Expected pong, got ${String(val)}`);
        return 'connected' as const;
      })(),
      5000,
      'Redis connection timeout (5s)',
    );

    const storageCheck = withTimeout(
      this.minio.checkConnection(),
      5000,
      'MinIO connection timeout (5s)',
    );

    // Execute checks in parallel
    const [dbResult, redisResult, storageResult] = await Promise.allSettled([
      dbCheck,
      redisCheck,
      storageCheck,
    ]);

    // Parse Database result
    let database: 'connected' | 'disconnected' = 'connected';
    if (dbResult.status === 'rejected') {
      database = 'disconnected';
      this.logger.error(`Database unhealthy: ${dbResult.reason.message}`);
    }

    // Parse Redis result
    let redis: 'connected' | 'disconnected' = 'connected';
    let redisError: string | undefined;
    if (redisResult.status === 'rejected') {
      redis = 'disconnected';
      redisError = redisResult.reason.message;
      this.logger.error(`Redis unhealthy: ${redisError}`);
    }

    // Parse Storage result
    let storage: 'connected' | 'disconnected' | 'local' = 'local';
    let storageError: string | undefined;
    if (storageResult.status === 'fulfilled') {
      storage = storageResult.value.status as any;
      storageError = storageResult.value.error;
      if (storage === 'disconnected') {
        this.logger.error(`Storage unhealthy: ${storageError}`);
      }
    } else {
      storage = 'disconnected';
      storageError = storageResult.reason.message;
      this.logger.error(`Storage unhealthy: ${storageError}`);
    }

    const durationMs = Date.now() - startTime;
    const isHealthy =
      database === 'connected' &&
      redis === 'connected' &&
      storage !== 'disconnected';
    const nextStatus = isHealthy ? 'ok' : 'degraded';
    const checkedAt = new Date().toISOString();

    // Log health status transitions
    const prevStatus = this.state.status;
    if (prevStatus !== 'starting' && prevStatus !== nextStatus) {
      this.logger.warn(
        `Health status changed from [${prevStatus.toUpperCase()}] to [${nextStatus.toUpperCase()}]`,
      );
    }

    // Update global cached state
    this.state = {
      status: nextStatus,
      database,
      redis,
      redisError,
      storage,
      storageError,
      checkedAt,
      lastSuccess: isHealthy ? checkedAt : this.state.lastSuccess,
      lastFailure: !isHealthy ? checkedAt : this.state.lastFailure,
      durationMs,
      consecutiveFailures: isHealthy ? 0 : this.state.consecutiveFailures + 1,
      version: process.env.VERSION || '1.0.0',
    };

    this.isChecking = false;
  }
}
