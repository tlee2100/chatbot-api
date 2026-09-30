import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../chat/entities/conversation.entity';
import { Users } from '../user/entities/user.entity';
import { Site } from '../site/entities/site.entity';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class McpService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly vectorStoreService: VectorStoreService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) { }

  async getConversationContext(id: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const messages = await this.chatMessageRepo.find({
      where: { conversation: { id } },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Sort ascending for chronological order
    const chronologicalMessages = messages.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    let summary = conversation.summary || '';
    if (summary.length > 1500) {
      summary = `${summary.substring(0, 1500)}...`;
    }

    return {
      siteId: conversation.siteId,
      visitorName: conversation.visitorName,
      status: conversation.status,
      handlingStatus: conversation.handlingStatus,
      summary,
      messages: chronologicalMessages.map((m) => ({
        role: m.senderType,
        timestamp: m.createdAt,
        content:
          m.content.length > 500 ? `${m.content.substring(0, 500)}... (truncated)` : m.content,
      })),
    };
  }

  async getUserDetailsByEmail(email: string) {
    const user = await this.usersRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    // Explicitly omit sensitive fields
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    };
  }

  async getSiteConfig(siteId: number) {
    const site = await this.siteRepo.findOne({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    return {
      id: site.id,
      name: site.name,
      url: site.url,
      themeColor: site.themeColor,
      logoUrl: site.logoUrl,
      welcomeMessage: site.welcomeMessage,
    };
  }

  async searchKnowledge(siteId: number, query: string) {
    const results = await this.vectorStoreService.similaritySearch(query, siteId, 5);

    // Deduplicate by documentId to retain memory-first/pgvector-fallback behavior logic
    const uniqueResults: typeof results = [];
    const seenDocs = new Set<number>();

    for (const res of results) {
      if (!seenDocs.has(res.documentId)) {
        seenDocs.add(res.documentId);
        uniqueResults.push(res);
      }
    }

    return uniqueResults;
  }

}
