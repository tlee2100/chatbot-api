import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { UserService } from '../user/user.service';
import { SiteService } from '../site/site.service';
import { VectorStoreService } from '../vector-store/vector-store.service';

@Injectable()
export class McpService {
  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService,
    private readonly siteService: SiteService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async getConversationContext(id: string) {
    const conversation = await this.chatService.getConversationById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const messages = await this.chatService.getMessagesForConversation(id, undefined, 10);

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
      messages: messages.map((m) => ({
        role: m.senderType,
        timestamp: m.createdAt,
        content:
          m.content.length > 500 ? `${m.content.substring(0, 500)}... (truncated)` : m.content,
      })),
    };
  }

  async getUserDetailsByEmail(email: string) {
    const user = await this.userService.findOne({ email });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

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
    const site = await this.siteService.findOne(siteId);

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
