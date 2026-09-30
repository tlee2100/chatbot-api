import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

// Kết nối Redis RIÊNG cho refresh token, tách biệt hoàn toàn với
// connection mà Bull đang dùng cho queue — tránh xung đột config
// (Bull yêu cầu maxRetriesPerRequest: null, ta thì không cần).
@Injectable()
export class RefreshTokenService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
    });
  }

  private key(userId: number) {
    return `refresh_token:${userId}`;
  }

  // Không lưu refresh token dạng plain-text trong Redis — chỉ lưu hash.
  // Nếu Redis bị dump/leak, kẻ tấn công vẫn không lấy lại được token gốc.
  private hash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async store(userId: number, refreshToken: string, ttlSeconds: number) {
    await this.redis.set(this.key(userId), this.hash(refreshToken), 'EX', ttlSeconds);
  }

  async verify(userId: number, refreshToken: string): Promise<boolean> {
    const stored = await this.redis.get(this.key(userId));
    if (!stored) return false;
    return stored === this.hash(refreshToken);
  }

  async revoke(userId: number) {
    await this.redis.del(this.key(userId));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
