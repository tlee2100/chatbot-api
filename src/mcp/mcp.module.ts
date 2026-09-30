import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { ChatModule } from '../chat/chat.module';
import { UserModule } from '../user/user.module';
import { SiteModule } from '../site/site.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [ChatModule, UserModule, SiteModule, VectorStoreModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
