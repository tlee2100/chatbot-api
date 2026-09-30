import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: WsJwtGuard,
          useValue: { authenticate: jest.fn() },
        },
        {
          provide: ChatService,
          useValue: {
            getAgentSiteIds: jest.fn().mockResolvedValue([1]),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
