import prompts from '@/lib/prompts';
import crypto from 'crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import {
  chatModelProviders,
  embeddingModelProviders,
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { orchestratorHandlers } from '@/lib/search';
import { containsYouTubeLink, extractYouTubeLinks } from '@/lib/utils/youtube';
import { trackAsync } from '@/lib/performance';
import { withErrorHandling, circuitBreakers } from '@/lib/errorHandling';
import { systemInstructions } from '@/lib/utils/personalization';
import conversationManager, { type ConversationContext } from '@/lib/conversation';
import { SearchStreamController, streamToAsyncIterator, SearchStreamData } from '@/lib/utils/streaming';
import QuickSearchOrchestrator from '@/lib/search/quickSearchOrchestrator';
import ProSearchOrchestrator from '@/lib/search/proSearchOrchestrator';
import UltraSearchOrchestrator from '@/lib/search/ultraSearchOrchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type ChatModel = {
  provider: string;
  name: string;
};

type EmbeddingModel = {
  provider: string;
  name: string;
};

type Body = {
  message: Message;
  searchMode?: string;

  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: ChatModel;
  embeddingModel: EmbeddingModel;
  systemInstructions: string;
  introduceYourself?: string;
  userLocation?: string;
};

const handleStreamingEvents = async (
  stream: ReadableStream<SearchStreamData>,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  aiMessageId: string,
  context: ConversationContext,
) => {
  let receivedMessage = '';
  let sources: any[] = [];
  let images: any[] = [];
  let videos: any[] = [];
  let searchIntent: any = null;
  let isStreamClosed = false;
  let pipelineStages: any[] = [];

  // Helper function to safely write to stream
  const safeWrite = async (data: string) => {
    try {
      if (!isStreamClosed) {
        await writer.ready;
        if (!isStreamClosed) {
          await writer.write(encoder.encode(data));
        }
      }
    } catch (error) {
      console.error('Error writing to stream:', error);
      isStreamClosed = true;
    }
  };

  // Helper function to safely close stream
  const safeClose = () => {
    try {
      if (!isStreamClosed) {
        isStreamClosed = true;
        writer.close();
      }
    } catch (error) {
      console.error('Error closing stream:', error);
    }
  };

  // Start the assistant response with pending status
  try {
    await conversationManager.startAssistantResponse(context, aiMessageId);
  } catch (error) {
    console.error('Failed to start assistant response:', error);
    await conversationManager.rollbackConversationTurn(context);
    safeWrite(JSON.stringify({ type: 'error', data: 'Failed to initialize response' }));
    safeClose();
    return;
  }

  try {
    // Process the stream using async iterator
    for await (const streamData of streamToAsyncIterator(stream)) {
      console.log('📨 API: Received stream event type:', streamData.type);

      switch (streamData.type) {
        case 'stage_complete':
          console.log('� API: Forwarding stage complete:', streamData.data.stage);
          await safeWrite(
            JSON.stringify({
              type: 'stage_complete',
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'sources_ready':
          console.log('📚 API: Forwarding sources, count:', streamData.data.count);
          sources = streamData.data.sources;
          await safeWrite(
            JSON.stringify({
              type: 'sources',
              data: streamData.data.sources,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'images_ready':
          console.log('🖼️ API: Forwarding images, count:', streamData.data.count);
          images = streamData.data.images;
          await safeWrite(
            JSON.stringify({
              type: 'images',
              data: streamData.data.images,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'videos_ready':
          console.log('🎥 API: Forwarding videos, count:', streamData.data.count);
          videos = streamData.data.videos;
          await safeWrite(
            JSON.stringify({
              type: 'videos',
              data: streamData.data.videos,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'response_chunk':
          console.log('💬 API: Forwarding response chunk, length:', streamData.data.chunk.length);
          receivedMessage += streamData.data.chunk;
          await safeWrite(
            JSON.stringify({
              type: 'response_chunk',
              data: streamData.data.chunk,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'response_complete':
          console.log('� API: Forwarding complete response, length:', streamData.data.message.length);
          receivedMessage = streamData.data.message;
          await safeWrite(
            JSON.stringify({
              type: 'message',
              data: streamData.data.message,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'pipeline_progress':
          console.log('⚡ API: Forwarding pipeline progress:', streamData.data.stage, streamData.data.progress);
          await safeWrite(
            JSON.stringify({
              type: 'pipeline_progress',
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'stage_progress':
          console.log('� API: Forwarding stage progress:', streamData.data.stage, streamData.data.subStage);
          await safeWrite(
            JSON.stringify({
              type: 'stage_progress',
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'search_complete':
          console.log('✅ API: Search completed, execution time:', streamData.data.executionTime);
          await safeWrite(
            JSON.stringify({
              type: 'search_complete',
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        case 'search_error':
          console.log('❌ API: Search error:', streamData.data.error);
          await safeWrite(
            JSON.stringify({
              type: 'search_error',
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;

        default:
          console.log('🔄 API: Forwarding unknown event type:', streamData.type);
          await safeWrite(
            JSON.stringify({
              type: streamData.type,
              data: streamData.data,
              messageId: aiMessageId,
            }) + '\n',
          );
          break;
      }
    }

    // Stream completed successfully
    console.log('🔚 API: Stream ended, completing conversation turn...');
    
    await safeWrite(
      JSON.stringify({
        type: 'messageEnd',
        messageId: aiMessageId,
      }) + '\n',
    );

    safeClose();

    // Complete the conversation turn using the new system
    await conversationManager.completeAssistantMessage(
      aiMessageId,
      receivedMessage,
      {
        ...(sources && sources.length > 0 && { sources }),
        ...(images && images.length > 0 && { images }),
        ...(videos && videos.length > 0 && { videos }),
        ...(searchIntent && { searchIntent }),
      }
    );
    
    console.log('✅ Conversation turn completed successfully');
    
  } catch (error) {
    console.error('Error processing stream:', error);
    
    await safeWrite(
      JSON.stringify({
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Stream processing error' },
        messageId: aiMessageId,
      }) + '\n',
    );
    
    safeClose();
    
    // Rollback the conversation turn on error
    await conversationManager.rollbackConversationTurn(context);
  }
};

export const POST = async (req: Request) => {
  return await trackAsync(
    'chat_api_request',
    async () => {
      return await withErrorHandling(
        async () => {
          const requestId = Date.now().toString(36);
          console.log(`=== Chat API route called (ID: ${requestId}) ===`);
          const body = (await req.json()) as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      chatModelProviders[
        body.chatModel?.provider || Object.keys(chatModelProviders)[0]
      ];
    const chatModel =
      chatModelProvider[
        body.chatModel?.name || Object.keys(chatModelProvider)[0]
      ];

    const embeddingProvider =
      embeddingModelProviders[
        body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0]
      ];
    const embeddingModel =
      embeddingProvider[
        body.embeddingModel?.name || Object.keys(embeddingProvider)[0]
      ];

    let llm: BaseChatModel | undefined;
    let embedding = embeddingModel.model;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        openAIApiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model' }, { status: 400 });
    }

    if (!embedding) {
      return Response.json(
        { error: 'Invalid embedding model' },
        { status: 400 },
      );
    }

    const humanMessageId =
      message.messageId ?? crypto.randomBytes(7).toString('hex');
    const aiMessageId = crypto.randomBytes(7).toString('hex');

    // Start conversation turn using the new system
    let conversationContext: ConversationContext;
    try {
      conversationContext = await conversationManager.beginConversationTurn(
        message.chatId,
        humanMessageId,
        message.content,
        body.files
      );
    } catch (error) {
      console.error('Failed to start conversation turn:', error);
      return Response.json(
        { error: 'Failed to initialize conversation' },
        { status: 500 }
      );
    }

    const history: BaseMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return new HumanMessage({
          content: msg[1],
        });
      } else {
        return new AIMessage({
          content: msg[1],
        });
      }
    });

    // Check for YouTube links in the message
    const youtubeLinks = extractYouTubeLinks(message.content);
    
    if (youtubeLinks.length > 0) {
      console.log(`=== Found ${youtubeLinks.length} YouTube links, processing... (ID: ${requestId}) ===`);
      
      // Process the first YouTube link found
      const youtubeUrl = youtubeLinks[0];
      
      try {
        // Call the YouTube API directly
        console.log(`=== Calling YouTube API for URL: ${youtubeUrl} (ID: ${requestId}) ===`);
        const url = new URL(req.url);
        const summaryResponse = await fetch(`${url.origin}/api/youtube`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: youtubeUrl,
            chatHistory: body.history.map(([role, content]) => ({ role, content })),
            chatModel: body.chatModel,
            systemInstructions: `${body.systemInstructions}\n\nUser's current request: ${message.content}`,
          }),
        });
        
        if (!summaryResponse.ok) {
          throw new Error('Failed to generate YouTube analysis');
        }
        
        const summaryData = await summaryResponse.json();
        console.log(`=== YouTube API response received, summary length: ${summaryData.summary?.length || 0} (ID: ${requestId}) ===`);
        
        // Create response stream
        const responseStream = new TransformStream();
        const writer = responseStream.writable.getWriter();
        const encoder = new TextEncoder();
        
        // Send the response based on user's request
        const responseTitle = message.content.toLowerCase().includes('recipe') ? 'YouTube Recipe' :
                             message.content.toLowerCase().includes('tutorial') ? 'YouTube Tutorial' :
                             message.content.toLowerCase().includes('how') ? 'YouTube How-to Guide' :
                             'YouTube Video Analysis';
        
        const responseData = `## ${responseTitle}\n\n**${summaryData.videoInfo.title}**\n\n*by ${summaryData.videoInfo.channel} • ${summaryData.videoInfo.duration} • ${summaryData.videoInfo.viewCount} views*\n\n${summaryData.summary}\n\n---\n*[Watch on YouTube](${youtubeUrl})*`;
        console.log(`=== Response data created, length: ${responseData.length} (ID: ${requestId}) ===`);
        
        // Send the complete response in one message with a special flag
        console.log(`=== Sending complete response (ID: ${requestId}) ===`);
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'message',
              data: responseData,
              messageId: aiMessageId,
              isComplete: true, // Flag to indicate this is a complete response
            }) + '\n',
          ),
        );
        
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'messageEnd',
              messageId: aiMessageId,
            }) + '\n',
          ),
        );
        
        writer.close();
        
        // Complete conversation turn with the new system
        try {
          await conversationManager.completeConversationTurn(
            conversationContext,
            aiMessageId,
            responseData
          );
          console.log(`✅ YouTube conversation turn completed successfully (ID: ${requestId})`);
        } catch (error) {
          console.error('Error completing YouTube conversation turn:', error);
          await conversationManager.rollbackConversationTurn(conversationContext);
        }
        
        console.log(`YouTube processing completed successfully, returning response (ID: ${requestId})`);
        
        // Return the response and EXIT - no fallback to normal search
        return new Response(responseStream.readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            Connection: 'keep-alive',
            'Cache-Control': 'no-cache, no-transform',
          },
        });
        
      } catch (error) {
        console.error('Error processing YouTube link:', error);
        console.log('YouTube processing failed, will continue to normal search');
        // Continue to normal search if YouTube processing fails
      }
    }

    // Use new orchestrator handlers with streaming
    const searchMode = body.searchMode || 'quickSearch';
    
    console.log('🔍 Search mode:', searchMode);
    console.log('� Using streaming orchestrator');
    
    // Combine system instructions with personalization data
    const enhancedSystemInstructions = systemInstructions(
      body.systemInstructions || '',
      {
        introduceYourself: body.introduceYourself,
        userLocation: body.userLocation,
      }
    );
    
    console.log('🎯 Enhanced system instructions with personalization data');
    
    // Create orchestrator instance based on search mode
    let orchestrator;
    switch (searchMode) {
      case 'proSearch':
        orchestrator = new ProSearchOrchestrator();
        break;
      case 'ultraSearch':
        orchestrator = new UltraSearchOrchestrator();
        break;
      default:
        orchestrator = new QuickSearchOrchestrator();
        break;
    }
    
    // Execute search with streaming
    try {
      // Create stream controller for real-time updates
      const streamController = new SearchStreamController();
      
      // Execute search with streaming support
      const resultPromise = orchestrator.planAndExecute(
        message.content,
        history,
        llm,
        embedding,
        body.files,
        enhancedSystemInstructions,
        streamController
      );

      // Get the stream immediately for real-time updates
      const stream = streamController.getStream();

      // Create response stream
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      // Handle streaming events and result in parallel
      handleStreamingEvents(stream, writer, encoder, aiMessageId, conversationContext).catch(error => {
        console.error('Error handling streaming events:', error);
        writer.close();
      });

      // Return streaming response immediately
      return new Response(responseStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache, no-transform',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        },
      });

    } catch (error) {
      console.error('Search execution failed:', error);
      
      // Rollback conversation turn on error
      await conversationManager.rollbackConversationTurn(conversationContext);
      
      return Response.json(
        {
          type: 'error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        },
        { status: 500 }
      );
    }
        },
        'chat_api',
        {
          circuitBreaker: circuitBreakers.llm,
          fallback: () => {
            return Response.json(
              { message: 'Service temporarily unavailable, please try again later' },
              { status: 503 },
            );
          },
        }
      );
    },
    { requestId: Date.now().toString(36) }
  );
};
