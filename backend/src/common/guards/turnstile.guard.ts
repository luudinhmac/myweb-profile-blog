import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class TurnstileGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.BYPASS_TURNSTILE === 'true') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-turnstile-token'];

    // Fallback to Cloudflare testing key in development if not configured
    const secretKey =
      process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

    if (!token) {
      throw new BadRequestException('Cloudflare Turnstile token is missing.');
    }

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            secret: secretKey,
            response: token,
            remoteip: request.ip || '',
          }),
        },
      );

      const data = (await response.json()) as {
        success: boolean;
        'error-codes'?: string[];
      };

      if (!data.success) {
        throw new ForbiddenException(
          `Turnstile verification failed: ${data['error-codes']?.join(', ') || 'invalid token'}`,
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ForbiddenException(
        `Failed to verify Turnstile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
