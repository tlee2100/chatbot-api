import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-api-key'];

    // In a real application, this secret should be stored securely in an environment variable.
    // For this implementation, we default it if it's not set.
    const expectedKey =
      this.configService.get<string>('INTERNAL_API_KEY') || 'default-internal-secret-key-123';

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}
