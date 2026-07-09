import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { InfrastructureConfigService } from './infrastructure/config/config.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: InfrastructureConfigService) => {
        try {
          const store = await redisStore({
            socket: {
              host: configService.redisHost,
              port: configService.redisPort,
              connectTimeout: 10000,
              reconnectStrategy: (retries) => {
                // Retry connection with exponential backoff capped at 5 seconds
                return Math.min(retries * 500, 5000);
              },
            },
            password: configService.redisPassword || undefined,
            ttl: 600000, // 10 minutes (600,000 milliseconds)
          });

          // Register error event listener on client to prevent runtime crashes
          const client = store.client;
          if (client) {
            client.on('error', (err: unknown) => {
              console.error(
                'Redis client error:',
                err instanceof Error ? err.message : String(err),
              );
            });
          }

          return { store };
        } catch (error) {
          console.warn(
            'Could not initialize Redis cache store. Falling back to in-memory cache.',
            error instanceof Error ? error.message : String(error),
          );
          return {
            store: 'memory',
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
