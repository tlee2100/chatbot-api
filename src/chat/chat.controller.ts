import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  UseGuards,
  Req,
  Res,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Paginate, ApiPaginationQuery } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { StreamChatDto } from './dto/stream-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Public endpoint: Visitor submits the landing form to start a new chat.
   * No authentication required — this is called by unauthenticated visitors.
   */
  @Post('conversations')
  async createConversation(@Body() dto: CreateConversationDto) {
    // 1. Save to DB
    const { conversation, firstMessage } = await this.chatService.createConversation(dto);

    // 2. Notify all agents watching this site via WebSocket
    this.chatGateway.notifyAgentsOfNewConversation(conversation);

    // 3. (REMOVED) The frontend will trigger the AI response via HTTP stream after redirecting

    // 4. Return the conversation details to the visitor's browser so they can navigate to the chat room
    return {
      conversationId: conversation.id,
      siteId: conversation.siteId,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      status: conversation.status,
      firstMessage: {
        id: firstMessage.id,
        content: firstMessage.content,
        createdAt: firstMessage.createdAt,
      },
    };
  }

  @Post('stream')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
  async streamChat(@Body() dto: StreamChatDto, @Res() res: Response) {
    // Set headers for plain text streaming (used by TextStreamChatTransport)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      await this.chatService.streamChatConversation(dto, (chunk) => res.write(chunk));
    } finally {
      res.end();
    }
  }

  /**
   * Protected endpoint: Agent fetches all OPEN conversations for their assigned sites.
   */
  @UseGuards(AuthGuard('jwt'))
  @ApiPaginationQuery({
    sortableColumns: ['id', 'createdAt', 'updatedAt', 'lastActivityAt'],
    filterableColumns: { siteId: true, status: true },
    defaultSortBy: [['lastActivityAt', 'DESC']],
  })
  @Get('conversations/active')
  async getActiveConversations(@Paginate() query: PaginateQuery, @Req() req: Request) {
    const { user } = req as any;
    return this.chatService.getActiveConversations(query, user.id);
  }

  /**
   * Protected endpoint: Agent fetches a single conversation details.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversationById(id);
  }

  /**
   * Public endpoint: Visitor or Agent fetches message history for a conversation.
   */

  @Get('conversations/:id/meta')
  async getConversationMeta(@Param('id') id: string) {
    const conversation = await this.chatService.getConversationById(id);
    if (!conversation) return null;
    return {
      isAiActive: conversation.isAiActive,
      status: conversation.status,
      handlingStatus: conversation.handlingStatus,
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('conversations/:id/messages')
  async getConversationMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const cursorDate = cursor ? new Date(cursor) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const messages = await this.chatService.getMessagesForConversation(id, cursorDate, parsedLimit);

    const isAgent = !!(req as any).user;
    if (!isAgent) {
      return messages.map((m) => {
        const { knowledgeSources, ...rest } = m;
        return rest;
      });
    }

    return messages;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return {
      url: `/uploads/chat/${file.filename}`,
      fileName: file.originalname,
      fileType: file.mimetype,
      size: file.size,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('conversations/:id/close')
  async closeConversation(@Param('id') id: string) {
    const conversation = await this.chatService.closeConversation(id);
    this.chatGateway.notifyConversationClosed(id);
    return conversation;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('conversations/:id')
  async deleteConversation(@Param('id') id: string) {
    await this.chatService.deleteConversation(id);
    this.chatGateway.notifyConversationClosed(id);
    return { success: true };
  }
}
