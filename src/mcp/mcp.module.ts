import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { Conversation } from '../chat/entities/conversation.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { Users } from '../user/entities/user.entity';
import { Site } from '../site/entities/site.entity';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ChatMessage, Users, Site]), VectorStoreModule, ChatModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
