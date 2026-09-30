import { Controller, Get, Post, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { McpService } from './mcp.service';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

@UseGuards(InternalApiKeyGuard)
@Controller('api/internal/mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) { }

  @Get('conversations/:id/context')
  getConversationContext(@Param('id') id: string) {
    return this.mcpService.getConversationContext(id);
  }

  @Get('users')
  getUserDetails(@Query('email') email: string) {
    return this.mcpService.getUserDetailsByEmail(email);
  }

  @Get('sites/:id/config')
  getSiteConfig(@Param('id', ParseIntPipe) id: number) {
    return this.mcpService.getSiteConfig(id);
  }

  @Post('knowledge/search')
  searchKnowledge(@Body('siteId', ParseIntPipe) siteId: number, @Body('query') query: string) {
    return this.mcpService.searchKnowledge(siteId, query);
  }

}
