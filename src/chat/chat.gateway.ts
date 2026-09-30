import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { ChatService } from './chat.service';
import { Conversation, HandlingStatus } from './entities/conversation.entity';
import { ChatMessage, SenderType, MessageStatus } from './entities/chat-message.entity';
import { AiService } from './ai.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // Add disconnecting listener to track presence before rooms are cleared
    client.on('disconnecting', () => {
      client.rooms.forEach((room) => {
        if (room.startsWith('conversation-')) {
          client.to(room).emit('participantPresence', { online: false });
        }
      });
    });

    try {
      // 1. Try to authenticate as an Agent (throws if no valid JWT)
      const user = this.wsJwtGuard.authenticate(client as any);
      // Agent authenticated — join them into their assigned site rooms
      await this.chatService.handleClientConnected(client as any, user);
    } catch (e) {
      // 2. Not an agent — check if it's a Visitor with a conversationId
      const conversationId = client.handshake.query.conversationId as string;
      if (conversationId) {
        client.join(`conversation-${conversationId}`);
        console.log(`Visitor joined conversation room: conversation-${conversationId}`);
        // Notify others in room that visitor is online
        client.to(`conversation-${conversationId}`).emit('participantPresence', {
          online: true,
          senderType: 'VISITOR',
        });
        // Request others to announce themselves so we know they are online
        client.to(`conversation-${conversationId}`).emit('presenceRequested');
      } else {
        // Neither — reject the connection
        client.emit('exception', { message: 'Unauthorized' });
        client.disconnect(true);
      }
    }
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Called by the REST controller after a conversation is created in the DB.
   * Broadcasts the new conversation to all agents watching the site room.
   */
  notifyAgentsOfNewConversation(conversation: Conversation): void {
    this.server.to(`site-${conversation.siteId}`).emit('newConversation', {
      id: conversation.id,
      siteId: conversation.siteId,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      status: conversation.status,
    });
    console.log(
      `Notified agents in site-${conversation.siteId} of new conversation: ${conversation.id}`,
    );
  }

  notifyConversationAssigned(conversationId: string, siteId: number): void {
    this.server.to(`site-${siteId}`).emit('conversationAssigned', { id: conversationId });
  }

  notifyConversationClosed(conversationId: string): void {
    this.server
      .to(`conversation-${conversationId}`)
      .emit('conversationClosed', { id: conversationId });
  }

  /**
   * Called by agents when they click "Join Chat" to enter a conversation room.
   */
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    try {
      const user = (client as any).data?.user;
      if (user) {
        // Enforce 1-agent limit
        const { conversation, isNewAssignment } = await this.chatService.assignAgentToConversation(
          payload.conversationId,
          user.id,
        );

        // Notify all agents watching this site so they can refresh their inbox
        this.notifyConversationAssigned(conversation.id, conversation.siteId);

        if (isNewAssignment) {
          // Add an automated AI message to the chat so the visitor knows
          const joinMsg = 'An agent has joined the chat.';
          const savedMessage = await this.chatService.saveMessage(
            payload.conversationId,
            joinMsg,
            SenderType.AI,
          );

          // Broadcast to the room (others already in the room like the visitor)
          client.to(`conversation-${payload.conversationId}`).emit('newMessage', {
            id: savedMessage.id,
            conversationId: payload.conversationId,
            message: savedMessage.content,
            senderType: savedMessage.senderType,
            createdAt: savedMessage.createdAt,
          });

          // Broadcast AI toggle off event to sync UI
          this.server.to(`conversation-${payload.conversationId}`).emit('aiToggled', {
            conversationId: payload.conversationId,
            isAiActive: false,
          });
          this.server.to(`site-${conversation.siteId}`).emit('aiToggled', {
            conversationId: payload.conversationId,
            isAiActive: false,
          });
        }
      }

      client.join(`conversation-${payload.conversationId}`);
      client.join(`agent-conversation-${payload.conversationId}`);
      console.log(
        `Agent ${client.id} joined conversation room: conversation-${payload.conversationId}`,
      );

      // Notify others in room that agent is online
      client.to(`conversation-${payload.conversationId}`).emit('participantPresence', {
        online: true,
        senderType: 'AGENT',
      });
      client.to(`conversation-${payload.conversationId}`).emit('agentJoined', {
        conversationId: payload.conversationId,
        handlingStatus: 'AGENT_HANDLING',
      });
      // Request others to announce themselves so we know they are online
      client.to(`conversation-${payload.conversationId}`).emit('presenceRequested');
    } catch (error: any) {
      client.emit('joinError', { message: error.message });
    }
  }

  /**
   * Called by agents when they want to view a conversation without joining.
   */
  @SubscribeMessage('subscribeConversation')
  async handleSubscribeConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    client.join(`conversation-${payload.conversationId}`);
    client.join(`agent-conversation-${payload.conversationId}`);
    console.log(
      `Agent ${client.id} subscribed to conversation room: conversation-${payload.conversationId}`,
    );
  }

  /**
   * Handles a message from either visitor or agent.
   * Uses client.to() instead of this.server.to() to avoid echoing back to the sender.
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string;
      message: string;
      senderType: SenderType;
      localId?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
    },
  ): Promise<void> {
    const conversation = await this.chatService.getConversationById(payload.conversationId);

    // Block visitor from sending messages if waiting for agent
    if (
      conversation &&
      conversation.handlingStatus === HandlingStatus.WAITING_FOR_AGENT &&
      payload.senderType === SenderType.VISITOR
    ) {
      client.emit('messageError', { message: 'Cannot send message while waiting for an agent' });
      return;
    }

    // 1. Save message to DB
    const savedMessage = await this.chatService.saveMessage(
      payload.conversationId,
      payload.message,
      payload.senderType,
      payload.fileUrl,
      payload.fileName,
      payload.fileType,
    );

    // If the conversation was paused, it is now OPEN. We should notify clients so they can update UI
    this.server
      .to(`conversation-${payload.conversationId}`)
      .emit('conversationResumed', { id: payload.conversationId });

    // Notify agents watching the site inbox to re-fetch/re-sort their list
    if (conversation) {
      this.server
        .to(`site-${conversation.siteId}`)
        .emit('conversationActivity', { id: payload.conversationId });
    }

    // 2. Broadcast to everyone EXCEPT the sender
    client.to(`conversation-${payload.conversationId}`).emit('newMessage', {
      ...payload,
      id: savedMessage.id,
      createdAt: savedMessage.createdAt,
      fileUrl: savedMessage.fileUrl,
      fileName: savedMessage.fileName,
      fileType: savedMessage.fileType,
      reactions: savedMessage.reactions,
    });

    // 3. Echo back to the sender with the real DB id so they can reconcile their local fake UUID
    client.emit('messageSaved', {
      localId: payload.localId,
      id: savedMessage.id,
      createdAt: savedMessage.createdAt,
      status: savedMessage.status,
      fileUrl: savedMessage.fileUrl,
      fileName: savedMessage.fileName,
      fileType: savedMessage.fileType,
      reactions: savedMessage.reactions,
    });

    // 4. Trigger AI if appropriate
    if (payload.senderType === SenderType.VISITOR && conversation && conversation.isAiActive) {
      // Do not await, fire and forget so it doesn't block
      // (REMOVED) This is now handled by the frontend via HTTP streaming (useChat) calling /api/chat/stream
    }
  }

  /**
   * Handles typing indicator events.
   */
  @SubscribeMessage('pauseConversation')
  async handlePauseConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    await this.chatService.pauseConversation(payload.conversationId);
    this.server
      .to(`conversation-${payload.conversationId}`)
      .emit('conversationPaused', { id: payload.conversationId });
  }

  @SubscribeMessage('reactMessage')
  async handleReactMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { messageId: string; emoji: string; userId: string; conversationId: string },
  ): Promise<void> {
    const updatedMessage = await this.chatService.toggleReaction(
      payload.messageId,
      payload.emoji,
      payload.userId,
    );
    this.server.to(`conversation-${payload.conversationId}`).emit('messageReactionUpdated', {
      messageId: payload.messageId,
      reactions: updatedMessage.reactions,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { conversationId: string; isTyping: boolean },
  ): void {
    client.to(`conversation-${payload.conversationId}`).emit('typing', payload);
  }

  @SubscribeMessage('announcePresence')
  handleAnnouncePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; senderType: SenderType },
  ): void {
    client.to(`conversation-${payload.conversationId}`).emit('participantPresence', {
      online: true,
      senderType: payload.senderType,
    });
  }

  @SubscribeMessage('markAsDelivered')
  async handleMarkAsDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; messageId: string },
  ): Promise<void> {
    await this.chatService.updateMessageStatus(payload.messageId, MessageStatus.DELIVERED);
    client.to(`conversation-${payload.conversationId}`).emit('messageStatus', {
      messageId: payload.messageId,
      status: MessageStatus.DELIVERED,
    });
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; messageId: string },
  ): Promise<void> {
    await this.chatService.updateMessageStatus(payload.messageId, MessageStatus.READ);
    client.to(`conversation-${payload.conversationId}`).emit('messageStatus', {
      messageId: payload.messageId,
      status: MessageStatus.READ,
    });
  }

  @SubscribeMessage('toggleAi')
  async handleToggleAi(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isAiActive: boolean },
  ): Promise<void> {
    // We could add a service method to update just isAiActive, but let's reuse conversation repo
    // In a real app we'd verify the user is an agent assigned to this conversation/site
    const conversation = await this.chatService.getConversationById(payload.conversationId);
    if (conversation) {
      // Need to update conversation, let's create a quick workaround or assume chatService has an update method
      // Actually we should add an update method to chatService or just use the repository if we injected it.
      // We didn't inject repo here. We'll need to add it to ChatService.
      await this.chatService.updateConversationAiStatus(payload.conversationId, payload.isAiActive);

      this.server.to(`conversation-${payload.conversationId}`).emit('aiToggled', {
        conversationId: payload.conversationId,
        isAiActive: payload.isAiActive,
      });

      // Notify agents viewing the inbox
      this.server.to(`site-${conversation.siteId}`).emit('aiToggled', {
        conversationId: payload.conversationId,
        isAiActive: payload.isAiActive,
      });
    }
  }

  @SubscribeMessage('callAgent')
  async handleCallAgent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const conversation = await this.chatService.getConversationById(payload.conversationId);
    if (conversation) {
      // 1. Trigger the dashboard notification
      await this.chatService.requestHandoff(payload.conversationId);
      this.server.to(`conversation-${payload.conversationId}`).emit('handlingStatusUpdated', {
        conversationId: payload.conversationId,
        handlingStatus: 'WAITING_FOR_AGENT',
      });

      // 2. Add an automated AI message to the chat so the visitor knows
      const handoffMsg = 'An agent has been notified and will be with you shortly.';
      const savedMessage = await this.chatService.saveMessage(
        payload.conversationId,
        handoffMsg,
        SenderType.AI,
      );

      // 3. Broadcast to the room
      this.server.to(`conversation-${payload.conversationId}`).emit('newMessage', {
        id: savedMessage.id,
        conversationId: payload.conversationId,
        message: savedMessage.content,
        senderType: savedMessage.senderType,
        createdAt: savedMessage.createdAt,
      });
    }
  }

  @SubscribeMessage('endConversation')
  async handleEndConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const conversation = await this.chatService.closeConversation(payload.conversationId);

    // Broadcast the closed event so agents can see the chat was ended by the visitor
    this.server
      .to(`conversation-${payload.conversationId}`)
      .emit('conversationClosed', { id: payload.conversationId });

    // Notify agents watching the site inbox to re-fetch/re-sort their list
    if (conversation) {
      this.server
        .to(`site-${conversation.siteId}`)
        .emit('conversationActivity', { id: payload.conversationId });
    }
  }
}
