import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [forwardRef(() => AuthModule)], // để lấy WsJwtGuard + JwtService qua export của AuthModule
  providers: [NotificationsGateway],
  exports: [NotificationsGateway], // module khác inject vào để gọi .notify(...)
})
export class NotificationsModule {}
