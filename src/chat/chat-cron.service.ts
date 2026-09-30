import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatCronService {
  private readonly logger = new Logger(ChatCronService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleIdleConversations() {
    // Default to 5 minutes if not configured
    const timeoutMinutes = this.configService.get<number>('CHAT_IDLE_TIMEOUT_MINUTES', 5);
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeoutMs);

    try {
      const idleConversations = await this.chatService.getIdleOpenConversations(cutoffDate);

      if (idleConversations.length > 0) {
        this.logger.log(`Found ${idleConversations.length} idle conversations to close.`);
      }

      for (const conversation of idleConversations) {
        await this.chatService.closeConversation(conversation.id);
        this.chatGateway.notifyConversationClosed(conversation.id);
        this.logger.log(`Auto-closed idle conversation ${conversation.id}`);
      }
    } catch (error) {
      this.logger.error('Error auto-closing idle conversations', error);
    }
  }
}
