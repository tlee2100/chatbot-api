import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';
import type { NotificationPayload } from './interfaces/notification-payload.interface';

const NOTIFICATIONS_ROOM = 'notifications';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3001' },
  namespace: '/notifications',
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtGuard: WsJwtGuard) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const user = this.wsJwtGuard.authenticate(client);

      await client.join(NOTIFICATIONS_ROOM);
      await client.join(`user_${user.id}`);
      this.logger.log(`Client ${client.id} (user #${user.id}) connected to /notifications`);
    } catch {
      client.emit('exception', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`Client ${client.id} disconnected from /notifications`);
  }

  // Gọi từ bất kỳ service nào (UserService khi tạo user mới, Bull processor
  // khi job xong...) để bắn notification tới mọi admin đang mở dashboard
  notify(payload: Omit<NotificationPayload, 'id' | 'createdAt'>): void {
    const fullPayload: NotificationPayload = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.server.to(NOTIFICATIONS_ROOM).emit('notification', fullPayload);
  }

  // Gửi thông báo đến danh sách người dùng cụ thể
  notifyUsers(userIds: number[], payload: Omit<NotificationPayload, 'id' | 'createdAt'>): void {
    if (!userIds || userIds.length === 0) return;

    const fullPayload: NotificationPayload = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Gửi đến room của từng user
    userIds.forEach((userId) => {
      this.server.to(`user_${userId}`).emit('notification', fullPayload);
    });
  }
}
