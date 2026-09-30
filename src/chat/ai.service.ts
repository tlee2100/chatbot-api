import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type ModelMessage } from 'ai';
import { ChatMessage, SenderType } from './entities/chat-message.entity';
import { VectorStoreService } from '../vector-store/vector-store.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private openaiProvider: any;

  private systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly vectorStoreService: VectorStoreService,
  ) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    const baseURL =
      this.configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.ai-box.vn/v1';
    this.systemPrompt =
      this.configService.get<string>('SYSTEM_PROMPT') ||
      'You are a helpful customer support chatbot. Please assist the visitor with their inquiries.';

    this.openaiProvider = createOpenAI({
      apiKey,
      baseURL,
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json();
          // Sanitize Deepseek response to prevent Vercel AI crash
          if (data?.output && Array.isArray(data.output)) {
            for (const out of data.output) {
              if (out.content && Array.isArray(out.content)) {
                for (const c of out.content) {
                  if (!c.annotations) c.annotations = [];
                }
              }
            }
          }
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        return response;
      },
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string | null> {
    try {
      // Map ChatMessage history to OpenAI format
      const formattedMessages: any[] = [];

      for (const msg of messages) {
        let role = 'user';
        if (msg.senderType === SenderType.AGENT || msg.senderType === SenderType.AI) {
          role = 'assistant';
        }

        // Skip messages without content (e.g. if they only had attachments)
        if (!msg.content) continue;

        formattedMessages.push({
          role,
          content: msg.content,
        });
      }

      const { text } = await generateText({
        model: this.openaiProvider('deepseek-v4-flash'),
        system: this.systemPrompt,
        messages: formattedMessages,
      });

      return text || null;
    } catch (error) {
      this.logger.error('Error generating AI response:', error);
      return null;
    }
  }
}
