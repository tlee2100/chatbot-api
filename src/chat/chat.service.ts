import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { paginate, Paginated } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, Brackets } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuthenticatedSocket } from '../auth/interfaces/authenticated-socket.interface';
import { Site } from '../site/entities/site.entity';
import { Conversation, ConversationStatus, HandlingStatus } from './entities/conversation.entity';
import { ChatMessage, SenderType, MessageStatus } from './entities/chat-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { NotificationsGateway } from '../auth/notifications/notifications.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Called when an authenticated agent WebSocket client connects.
   * Joins the agent into notification rooms for every site they own or are assigned to.
   */
  async handleClientConnected(client: AuthenticatedSocket, user: AuthenticatedUser): Promise<void> {
    // Find all sites the agent has access to (owned + assigned via site_agents table)
    const ownedSites = await this.siteRepository.find({ where: { ownerId: user.id } });
    const assignedSitesResult = await this.siteRepository
      .createQueryBuilder('site')
      .innerJoin('site.agents', 'agent', 'agent.id = :userId', { userId: user.id })
      .getMany();

    const allSiteIds = new Set([
      ...ownedSites.map((s) => s.id),
      ...assignedSitesResult.map((s) => s.id),
    ]);

    // Join a room for each site: agents in "site-1" room get notified when a visitor starts a chat on site 1
    for (const siteId of allSiteIds) {
      await client.join(`site-${siteId}`);
    }

    this.logger.log(
      `Agent ${user.email} connected. Joined site rooms: [${[...allSiteIds].join(', ')}]`,
    );
  }

  /**
   * Creates a new Conversation in the database and the visitor's first message.
   * Returns the saved conversation so the gateway can broadcast to agents.
   */
  async createConversation(
    dto: CreateConversationDto,
  ): Promise<{ conversation: Conversation; firstMessage: ChatMessage }> {
    // Verify the site exists and load agents for notifications
    const site = await this.siteRepository.findOne({
      where: { id: dto.siteId },
      relations: ['agents'],
    });
    if (!site) {
      throw new NotFoundException(`Site with ID ${dto.siteId} not found.`);
    }

    return await this.conversationRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // 1. Create and save the Conversation
        const conversation = transactionalEntityManager.create(Conversation, {
          siteId: dto.siteId,
          visitorName: dto.visitorName,
          visitorEmail: dto.visitorEmail,
          status: ConversationStatus.OPEN,
          lastActivityAt: new Date(),
        });
        const savedConversation = await transactionalEntityManager.save(Conversation, conversation);

        // 2. Save the visitor's first message using the SenderType enum
        const message = transactionalEntityManager.create(ChatMessage, {
          conversationId: savedConversation.id,
          senderType: SenderType.VISITOR,
          content: dto.firstMessage,
        });
        const savedMessage = await transactionalEntityManager.save(ChatMessage, message);

        this.logger.log(`New conversation created: ${savedConversation.id} for site ${dto.siteId}`);

        // 3. Notify assigned agents via the global notification bell
        const userIdsToNotify = new Set([site.ownerId]);
        if (site.agents) {
          site.agents.forEach((agent) => userIdsToNotify.add(agent.id));
        }

        this.notificationsGateway.notifyUsers(Array.from(userIdsToNotify), {
          type: 'chat.new',
          title: 'New Chat Request',
          message: `${dto.visitorName} started a new chat on site ${site.name}`,
          metadata: { conversationId: savedConversation.id },
        });

        return { conversation: savedConversation, firstMessage: savedMessage };
      },
    );
  }

  /**
   * Fetch OPEN conversations for the sites this agent owns or is assigned to, with pagination and filtering.
   */
  async getActiveConversations(
    query: PaginateQuery,
    agentId: number,
  ): Promise<Paginated<Conversation>> {
    const ownedSites = await this.siteRepository.find({ where: { ownerId: agentId } });
    const assignedSitesResult = await this.siteRepository
      .createQueryBuilder('site')
      .innerJoin('site.agents', 'agent', 'agent.id = :userId', { userId: agentId })
      .getMany();

    const allSiteIds = new Set([
      ...ownedSites.map((s) => s.id),
      ...assignedSitesResult.map((s) => s.id),
    ]);

    if (allSiteIds.size === 0) {
      // Return empty paginated object if no sites
      return {
        data: [],
        meta: {
          itemsPerPage: query.limit || 20,
          totalItems: 0,
          currentPage: query.page || 1,
          totalPages: 0,
          sortBy: [],
          searchBy: [],
          search: '',
          filter: {},
        },
        links: { first: '', previous: '', current: '', next: '', last: '' },
      } as any;
    }

    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.siteId IN (:...siteIds)', { siteIds: Array.from(allSiteIds) })
      .andWhere(
        new Brackets((qb) => {
          // Condition 1: Chat is unassigned
          qb.where('conversation.agentId IS NULL')
            // Condition 2: Chat is assigned to THIS agent
            .orWhere('conversation.agentId = :agentId', { agentId });

          // Condition 3: Agent is the Owner (Admin) of the site where the chat originated
          if (ownedSites.length > 0) {
            qb.orWhere('conversation.siteId IN (:...ownedSiteIds)', {
              ownedSiteIds: ownedSites.map((s) => s.id),
            });
          }
        }),
      );

    const paginatedResult = await paginate(query, queryBuilder, {
      sortableColumns: ['id', 'createdAt', 'updatedAt', 'status', 'siteId', 'lastActivityAt'],
      defaultSortBy: [['lastActivityAt', 'DESC']],
      filterableColumns: {
        siteId: true,
        status: true,
      },
    });

    // Fetch the latest message for each conversation to display as a snippet
    for (const conv of paginatedResult.data) {
      const latestMsg = await this.chatMessageRepository.findOne({
        where: { conversationId: conv.id },
        order: { createdAt: 'DESC' },
      });
      (conv as any).latestMessage = latestMsg;
    }

    return paginatedResult;
  }

  /**
   * Assigns an agent to a conversation if it isn't already taken by another agent.
   */
  async assignAgentToConversation(
    conversationId: string,
    agentId: number,
  ): Promise<{ conversation: Conversation; isNewAssignment: boolean }> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const site = await this.siteRepository.findOne({ where: { id: conversation.siteId } });
    const isAdmin = site?.ownerId === agentId;

    if (conversation.agentId && conversation.agentId !== agentId && !isAdmin) {
      throw new UnauthorizedException('There is an agent chatting in there');
    }

    let isNewAssignment = false;
    // Only assign ownership if the chat is currently unassigned
    if (!conversation.agentId) {
      conversation.agentId = agentId;
      conversation.handlingStatus = HandlingStatus.AGENT_HANDLING;
      conversation.isAiActive = false;
      await this.conversationRepository.save(conversation);
      isNewAssignment = true;
      this.logger.log(`Agent ${agentId} assigned to conversation ${conversationId}`);
    }

    return { conversation, isNewAssignment };
  }

  async verifyAgentAccessToSite(agentId: number, siteId: number): Promise<boolean> {
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
      relations: ['owner', 'agents'],
    });
    if (!site) return false;
    const isOwner = site.owner.id === agentId;
    const isAssignedAgent = site.agents.some((agent) => agent.id === agentId);
    if (!isOwner && !isAssignedAgent) {
      throw new UnauthorizedException('You do not have permission to view chats for this site.');
    }
    return true;
  }

  /**
   * Fetch messages for a specific conversation with cursor pagination
   */
  async getMessagesForConversation(
    conversationId: string,
    cursor?: Date,
    limit: number = 10,
  ): Promise<ChatMessage[]> {
    const whereClause: any = { conversationId };
    if (cursor) {
      whereClause.createdAt = LessThan(cursor);
    }

    const messages = await this.chatMessageRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return messages.reverse(); // Keep chronological order
  }

  /**
   * Fetch conversation details by ID
   */
  async getConversationById(id: string): Promise<Conversation> {
    return this.conversationRepository.findOneOrFail({ where: { id } });
  }

  /**
   * Update the rolling summary and count of summarized messages for a conversation
   */
  async updateConversationSummary(
    id: string,
    summary: string,
    summarizedMessageCount: number,
  ): Promise<void> {
    await this.conversationRepository.update(id, {
      summary,
      summarizedMessageCount,
    });
  }

  /**
   * Fetch OPEN conversations that have been inactive since before the cutoffDate
   */
  async getIdleOpenConversations(cutoffDate: Date): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        status: ConversationStatus.OPEN,
        lastActivityAt: LessThan(cutoffDate),
      },
    });
  }

  /**
   * Save a new message sent via WebSocket and update the conversation's lastActivityAt
   */
  async saveMessage(
    conversationId: string,
    content: string,
    senderType: SenderType,
    fileUrl?: string,
    fileName?: string,
    fileType?: string,
    knowledgeSources?: { documentId: number; filename: string }[],
  ): Promise<ChatMessage> {
    const message = this.chatMessageRepository.create({
      conversationId,
      content,
      senderType,
      fileUrl,
      fileName,
      fileType,
      knowledgeSources,
    });
    const savedMessage = await this.chatMessageRepository.save(message);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    // Update conversation lastActivityAt and unpause if paused
    if (conversation) {
      const updateData: any = { lastActivityAt: new Date() };
      if (conversation.status === ConversationStatus.PAUSED) {
        updateData.status = ConversationStatus.OPEN;
      }
      await this.conversationRepository.update(conversationId, updateData);
    }

    // Notify the assigned agent if the visitor sent a message
    if (senderType === SenderType.VISITOR && conversation?.agentId) {
      this.notificationsGateway.notifyUsers([conversation.agentId], {
        type: 'chat.message',
        title: 'New Message',
        message: `${conversation.visitorName}: ${content.length > 50 ? `${content.substring(0, 50)}...` : content}`,
        metadata: { conversationId },
      });
    }

    return savedMessage;
  }

  async closeConversation(id: string): Promise<Conversation> {
    await this.conversationRepository.update(id, { status: ConversationStatus.CLOSED });
    return this.conversationRepository.findOneOrFail({ where: { id } });
  }

  async pauseConversation(id: string): Promise<Conversation> {
    await this.conversationRepository.update(id, { status: ConversationStatus.PAUSED });
    return this.conversationRepository.findOneOrFail({ where: { id } });
  }

  async toggleReaction(messageId: string, emoji: string, userId: string): Promise<ChatMessage> {
    const message = await this.chatMessageRepository.findOneOrFail({ where: { id: messageId } });
    const reactions = message.reactions || {};

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const userIndex = reactions[emoji].indexOf(userId);
    if (userIndex > -1) {
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(userId);
    }

    message.reactions = reactions;
    return this.chatMessageRepository.save(message);
  }

  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    await this.chatMessageRepository.update(messageId, { status });
  }

  async deleteConversation(id: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found.`);
    }
    await this.conversationRepository.delete(id);
  }

  async updateConversationAiStatus(id: string, isAiActive: boolean): Promise<void> {
    await this.conversationRepository.update(id, { isAiActive });
  }

  async requestHandoff(conversationId: string): Promise<void> {
    const conversation = await this.getConversationById(conversationId);
    if (conversation) {
      conversation.handlingStatus = HandlingStatus.WAITING_FOR_AGENT;
      await this.conversationRepository.save(conversation);

      this.notificationsGateway.notify({
        type: 'system.alert',
        title: 'Human Agent Requested',
        message: `Visitor in conversation ${conversationId} requested a human agent.`,
        metadata: {
          conversationId,
          siteId: conversation.siteId,
        },
      });
      this.logger.log(`Handoff requested for conversation ${conversationId} via button`);
    }
  }
}
