import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { WsJwtGuard } from 'src/auth/guards/ws-jwt.guard';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { Conversation } from './entities/conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Site } from '../site/entities/site.entity';
import { ChatCronService } from './chat-cron.service';
import { NotificationsModule } from '../auth/notifications/notifications.module';
import { AiService } from './ai.service';
import { GraphService } from './graph.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([Conversation, ChatMessage, Site]),
    NotificationsModule,
    ConfigModule,
    VectorStoreModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, WsJwtGuard, ChatCronService, AiService, GraphService],
  exports: [ChatGateway, GraphService, ChatService],
})
export class ChatModule {}
