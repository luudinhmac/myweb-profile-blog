import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { InfrastructureConfigService } from './infrastructure/config/config.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: InfrastructureConfigService) => {
        try {
          const redisHost = configService.redisHost;
          const redisPort = configService.redisPort;
          const redisPassword = configService.redisPassword || undefined;

          // Build Redis connection URL
          const authPart = redisPassword
            ? `:${encodeURIComponent(redisPassword)}@`
            : '';
          const redisUrl = `redis://${authPart}${redisHost}:${redisPort}`;

          const keyvRedis = new KeyvRedis(redisUrl, {
            connectionTimeout: 10000,
          });

          // Register error event listener on client to prevent runtime crashes
          keyvRedis.on('error', (err: unknown) => {
            console.error(
              'Redis client error:',
              err instanceof Error ? err.message : String(err),
            );
          });

          return {
            stores: [
              new Keyv({
                store: keyvRedis,
                namespace: 'cache',
                ttl: 600000, // 10 minutes (600,000 milliseconds)
              }),
            ],
          };
        } catch (error) {
          console.warn(
            'Could not initialize Redis cache store. Falling back to in-memory cache.',
            error instanceof Error ? error.message : String(error),
          );
          return {
            ttl: 600000,
          };
        }
      },
      inject: [InfrastructureConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class CacheConfigModule {}
