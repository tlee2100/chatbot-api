import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { Site } from '../site/entities/site.entity';
import { Conversation } from './entities/conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { GraphService } from './graph.service';
import { ChatGateway } from './chat.gateway';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(Site),
          useValue: { find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: NotificationsGateway,
          useValue: { notify: jest.fn(), notifyUsers: jest.fn() },
        },
        {
          provide: GraphService,
          useValue: { streamChatResponse: jest.fn() },
        },
        {
          provide: ChatGateway,
          useValue: { notifyAiMessage: jest.fn(), notifyHandlingStatusUpdated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
