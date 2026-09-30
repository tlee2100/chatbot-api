import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { Conversation } from './entities/conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Site } from '../site/entities/site.entity';
import { ChatCronService } from './chat-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GraphService } from './graph.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Conversation, ChatMessage, Site]),
    NotificationsModule,
    ConfigModule,
    VectorStoreModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatCronService, GraphService],
  exports: [ChatGateway, GraphService, ChatService],
})
export class ChatModule {}
