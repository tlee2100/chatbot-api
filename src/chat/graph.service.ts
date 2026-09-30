import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response as ExpressResponse } from 'express';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { loadMcpTools } from '@langchain/mcp-adapters';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private systemPrompt: string;
  private apiKey: string;
  private baseURL: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.ai-box.vn/v1';
    this.systemPrompt =
      this.configService.get<string>('SYSTEM_PROMPT') ||
      'You are a helpful customer support chatbot. Please assist the visitor with their inquiries.';
  }

  async streamChatResponse(
    messages: any[],
    res: ExpressResponse,
    onFinish: (
      text: string,
      knowledgeSources?: { documentId: number; filename: string }[],
    ) => Promise<void>,
    onRequestHandoff: () => Promise<void>,
    siteId?: number,
    existingSummary?: string,
    existingSummarizedMessageCount: number = 0,
    conversationId?: string,
  ): Promise<{ newSummary?: string; newSummarizedMessageCount?: number }> {
    let mcpClient: Client | null = null;
    let mcpTransport: SSEClientTransport | null = null;

    try {
      const langchainMessages = messages.map((m: any) => {
        if (m.role === 'user') return new HumanMessage(m.content);
        if (m.role === 'assistant') return new AIMessage(m.content);
        if (m.role === 'system') return new SystemMessage(m.content);
        return new HumanMessage(m.content);
      });

      const mcpServerUrl = this.configService.get<string>('MCP_SERVER_URL') || 'http://localhost:3001/mcp/sse';
      const internalApiKey = this.configService.get<string>('INTERNAL_API_KEY') || '';

      const urlWithParams = new URL(mcpServerUrl);
      if (siteId) urlWithParams.searchParams.append('siteId', siteId.toString());
      if (conversationId) urlWithParams.searchParams.append('conversationId', conversationId);

      mcpTransport = new SSEClientTransport(urlWithParams, {
        requestInit: {
          headers: { 'x-internal-api-key': internalApiKey },
        }
      });
      mcpClient = new Client({ name: 'chatbot-api-client', version: '1.0.0' }, { capabilities: {} });
      await mcpClient.connect(mcpTransport);

      const mcpTools = await loadMcpTools('chatbot-mcp-server', mcpClient);
      const requestHumanTool = mcpTools.find(t => t.name.includes('requestHumanAgent'));
      const aiTools = mcpTools.filter(t => !t.name.includes('requestHumanAgent'));

      const toolNode = new ToolNode(mcpTools);

      const model = new ChatOpenAI({
        apiKey: this.apiKey,
        configuration: { baseURL: this.baseURL },
        modelName: 'qwen3.7-flash',
        streaming: true,
      }).bindTools(aiTools);

      type IntentType = 'question' | 'request_human' | 'small_talk' | null;
      const GraphState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
          reducer: (x, y) => x.concat(y),
          default: () => [],
        }),
        siteId: Annotation<number>({
          reducer: (x, y) => y,
          default: () => 0,
        }),
        intent: Annotation<IntentType>({
          reducer: (x, y) => y,
          default: () => null,
        }),
        knowledgeSources: Annotation<{ documentId: number; filename: string }[]>({
          reducer: (x, y) => y,
          default: () => [],
        }),
        summary: Annotation<string>({
          reducer: (x, y) => y,
          default: () => '',
        }),
        summarizedMessageCount: Annotation<number>({
          reducer: (x, y) => y,
          default: () => 0,
        }),
      });

      const classify_intent = async (state: typeof GraphState.State) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const prompt = `You are an intent classifier for a customer support chatbot. Determine the user's intent from the following message.
Reply ONLY with one of the following exact words: "question", "request_human", or "small_talk".
- Use "request_human" if they ask for an agent, human, support rep, or to talk to someone.
- Use "question" if they ask about the business, products, pricing, or need factual help.
- Use "small_talk" if they are just saying hello, thanks, goodbye, or casual chat.

Message: "${lastMessage.content}"`;

        const classifierModel = new ChatOpenAI({
          apiKey: this.apiKey,
          configuration: { baseURL: this.baseURL },
          modelName: 'qwen3.7-flash',
          temperature: 0,
        });
        const response = await classifierModel.invoke([{ role: 'user', content: prompt }]);
        const rawIntent = (response.content as string).toLowerCase().trim();
        let intent: IntentType = 'small_talk';
        if (rawIntent.includes('question')) intent = 'question';
        else if (rawIntent.includes('request_human')) intent = 'request_human';

        this.logger.log(`Intent classified as: ${intent}`);
        return { intent };
      };

      const request_handoff = async (state: typeof GraphState.State) => {
        if (requestHumanTool && conversationId) {
          try {
            await requestHumanTool.invoke({ conversationId, siteId: state.siteId });
          } catch (e) {
            this.logger.error('Failed to invoke requestHumanAgent tool', e);
            await onRequestHandoff(); // fallback
          }
        } else {
          await onRequestHandoff();
        }
        const handoffMsg = 'An agent has been notified and will be with you shortly.';
        res.write(handoffMsg);
        return { messages: [new AIMessage(handoffMsg)] };
      };

      const model_node = async (state: typeof GraphState.State) => {
        let finalSystemPrompt = this.systemPrompt;
        if (state.summary) {
          finalSystemPrompt += `\n\nSummary of earlier conversation: ${state.summary}`;
        }

        finalSystemPrompt += `\n\nSystem Context:\n- conversationId: ${conversationId}\n- siteId: ${siteId || state.siteId || 0}`;

        const messagesWithSystem = [new SystemMessage(finalSystemPrompt), ...state.messages];

        const response = await model.invoke(messagesWithSystem, {
          callbacks: [
            {
              handleLLMNewToken(token: string) {
                if (token) {
                  res.write(token);
                }
              },
            },
          ],
        });

        return { messages: [response] };
      };

      const parse_tools = async (state: typeof GraphState.State) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage instanceof ToolMessage && lastMessage.name && lastMessage.name.includes('searchKnowledge')) {
          try {
            const results = JSON.parse(lastMessage.content as string);
            const sourcesMap = new Map<number, string>();
            results.forEach((c: any) => {
              if (c.documentId && c.filename) {
                sourcesMap.set(c.documentId, c.filename);
              }
            });
            const knowledgeSources = Array.from(sourcesMap.entries()).map(([documentId, filename]) => ({
              documentId,
              filename,
            }));
            return { knowledgeSources };
          } catch (e) {
            this.logger.error('Failed to parse searchKnowledge output', e);
          }
        }
        return {};
      };

      const summarize_memory = async (state: typeof GraphState.State) => {
        if (state.messages.length > 10) {
          this.logger.log('Memory threshold exceeded. Summarizing older messages...');
          const messagesToSummarize = state.messages.slice(0, state.messages.length - 2);

          let summaryPrompt = '';
          if (state.summary) {
            summaryPrompt = `Update the following conversation summary with the new messages. Keep it concise. Focus on the main topics discussed and any resolutions.\n\nCurrent Summary: ${state.summary}\n\nNew Messages to summarize:\n${JSON.stringify(messagesToSummarize)}`;
          } else {
            summaryPrompt = `Summarize the following conversation concisely. Focus on the main topics discussed and any resolutions:\n${JSON.stringify(messagesToSummarize)}`;
          }

          const summarizerModel = new ChatOpenAI({
            apiKey: this.apiKey,
            configuration: { baseURL: this.baseURL },
            modelName: 'qwen3.7-flash',
          });
          const response = await summarizerModel.invoke([{ role: 'user', content: summaryPrompt }]);

          return {
            messages: state.messages.slice(state.messages.length - 2),
            summary: response.content as string,
            summarizedMessageCount: state.summarizedMessageCount + messagesToSummarize.length,
          };
        }
        return {};
      };

      const workflow = new StateGraph(GraphState)
        .addNode('classify_intent', classify_intent)
        .addNode('model_node', model_node)
        .addNode('tools', toolNode)
        .addNode('parse_tools', parse_tools)
        .addNode('request_handoff', request_handoff)
        .addNode('summarize_memory', summarize_memory);

      workflow.addEdge(START, 'classify_intent');
      workflow.addConditionalEdges('classify_intent', (state) => {
        if (state.intent === 'request_human') return 'request_handoff';
        return 'model_node';
      });

      workflow.addConditionalEdges('model_node', toolsCondition, {
        tools: 'tools',
        __end__: 'summarize_memory'
      });

      workflow.addEdge('tools', 'parse_tools');
      workflow.addEdge('parse_tools', 'model_node');
      workflow.addEdge('request_handoff', 'summarize_memory');
      workflow.addEdge('summarize_memory', END);

      const app = workflow.compile();

      const finalState = await app.invoke({
        messages: langchainMessages,
        siteId: siteId || 0,
        intent: null,
        knowledgeSources: [],
        summary: existingSummary || '',
        summarizedMessageCount: existingSummarizedMessageCount,
      });

      // Find the last AI message that has actual text content (not a tool-call message)
      const lastAiMessage = finalState.messages
        .slice()
        .reverse()
        .find((m: any) => {
          if (!m.constructor?.name?.includes('AIMessage')) return false;
          const content = m.content;
          if (!content) return false;
          // Skip messages that only have tool_calls (their content is empty string)
          if (typeof content === 'string' && content.trim().length === 0) return false;
          // Skip messages that are purely tool-call invocations (no text part)
          if (Array.isArray(content) && content.every((c: any) => c.type !== 'text')) return false;
          return true;
        });

      const diagLog = (msg: string) => {
        this.logger.log(msg);
        try { fs.appendFileSync(path.join(process.cwd(), 'save-diag.log'), `${new Date().toISOString()} ${msg}\n`); } catch { }
      };

      diagLog(`[Save] finalState.messages count: ${finalState.messages.length}`);
      diagLog(`[Save] lastAiMessage found: ${!!lastAiMessage}, content type: ${typeof lastAiMessage?.content}`);

      if (lastAiMessage && lastAiMessage.content) {
        const textContent = typeof lastAiMessage.content === 'string'
          ? lastAiMessage.content
          : (lastAiMessage.content as any[]).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
        diagLog(`[Save] textContent length: ${textContent.length}, preview: ${textContent.substring(0, 80)}`);
        if (textContent.trim()) {
          try {
            await onFinish(textContent, finalState.knowledgeSources);
            diagLog('[Save] onFinish completed successfully');
          } catch (finishErr: any) {
            diagLog(`[Save] onFinish THREW: ${finishErr?.message}`);
          }
        } else {
          diagLog('[Save] textContent was empty after trim — skipping save');
        }
      } else {
        diagLog('[Save] No valid lastAiMessage found');
        finalState.messages.forEach((m: any, i: number) => {
          diagLog(`[Save] msg[${i}] type=${m.constructor?.name}, contentType=${typeof m.content}, contentPreview=${JSON.stringify(m.content)?.substring(0, 60)}`);
        });
      }

      res.end();

      return {
        newSummary: finalState.summary !== existingSummary ? finalState.summary : undefined,
        newSummarizedMessageCount: finalState.summarizedMessageCount !== existingSummarizedMessageCount ? finalState.summarizedMessageCount : undefined,
      };

    } catch (error) {
      this.logger.error('Error in LangGraph workflow', error);
      const fallbackMsg = "I'm currently unable to access my tools, but I'll do my best to help you.";
      res.write(fallbackMsg);
      await onFinish(fallbackMsg);
      res.end();
      return {};
    } finally {
      if (mcpTransport) {
        await mcpTransport.close().catch(console.error);
      }
    }
  }
}
