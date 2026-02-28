import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { ChatOpenAI } from '@langchain/openai';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
  getDefaultChatModelKey,
  getDefaultChatProviderKey,
  getDefaultEmbeddingProviderKey,
} from '@/lib/providers';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { systemInstructions } from '@/lib/utils/personalization';
import { streamToAsyncIterator, SearchStreamData, createStreamingResponse, SearchStreamController } from '@/lib/utils/streaming';
import QuickSearchOrchestrator from '@/lib/search/quickSearchOrchestrator';
import ProSearchOrchestrator from '@/lib/search/proSearchOrchestrator';
import UltraSearchOrchestrator from '@/lib/search/ultraSearchOrchestrator';
import { saveSearchTurn } from '@/lib/supabase/search-history';
import { z } from 'zod';

interface chatModel {
  provider: string;
  name: string;
  customOpenAIKey?: string;
  customOpenAIBaseURL?: string;
}

interface embeddingModel {
  provider: string;
  name: string;
}

interface ChatRequestBody {
  chatModel?: chatModel;
  embeddingModel?: embeddingModel;
  query: string;
  sessionId?: string;
  history: Array<[string, string]>;
  stream?: boolean;
  systemInstructions?: string;
  searchMode?: string;
  introduceYourself?: string;
  userLocation?: string;
}

const SearchBodySchema = z.object({
  query: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
  history: z.array(z.tuple([z.string(), z.string()])).default([]),
  stream: z.boolean().optional().default(false),
  systemInstructions: z.string().max(8000).optional(),
  searchMode: z.enum(['quick', 'pro', 'ultra', 'proSearch', 'ultraSearch']).optional(),
  introduceYourself: z.string().max(500).optional(),
  userLocation: z.string().max(200).optional(),
  chatModel: z
    .object({
      provider: z.string(),
      name: z.string(),
      customOpenAIKey: z.string().optional(),
      customOpenAIBaseURL: z.string().optional(),
    })
    .optional(),
  embeddingModel: z
    .object({
      provider: z.string(),
      name: z.string(),
    })
    .optional(),
});

export const POST = async (req: Request) => {
  try {
    const parsed = SearchBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request body', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body: ChatRequestBody = parsed.data;

    if (!body.query) {
      return Response.json(
        { message: 'Missing query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.stream = body.stream || false;

    const history: BaseMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? new HumanMessage({ content: msg[1] })
        : new AIMessage({ content: msg[1] });
    });

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const selectedChatProvider =
      body.chatModel?.provider || getDefaultChatProviderKey(chatModelProviders);
    const chatModelProvider = chatModelProviders[selectedChatProvider];
    const chatModel =
      body.chatModel?.name || getDefaultChatModelKey(chatModelProvider);

    const embeddingModelProvider =
      body.embeddingModel?.provider ||
      getDefaultEmbeddingProviderKey(embeddingModelProviders);
    const embeddingModel =
      body.embeddingModel?.name ||
      Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: body.chatModel?.name || getCustomOpenaiModelName(),
        openAIApiKey:
          body.chatModel?.customOpenAIKey || getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL:
            body.chatModel?.customOpenAIBaseURL || getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProvider &&
      chatModelProvider[chatModel]
    ) {
      llm = chatModelProvider[chatModel]
        .model as unknown as BaseChatModel | undefined;
    }

    if (
      embeddingModelProviders[embeddingModelProvider] &&
      embeddingModelProviders[embeddingModelProvider][embeddingModel]
    ) {
      embeddings = embeddingModelProviders[embeddingModelProvider][
        embeddingModel
      ].model as Embeddings | undefined;
    }

    if (!llm || !embeddings) {
      return Response.json(
        { message: 'Invalid model selected' },
        { status: 400 },
      );
    }

    // Determine search mode and create orchestrator
    const searchMode = body.searchMode || 'quick';
    
    let orchestrator;
    switch (searchMode) {
      case 'proSearch':
      case 'pro':
        orchestrator = new ProSearchOrchestrator();
        break;
      case 'ultraSearch':
      case 'ultra':
        orchestrator = new UltraSearchOrchestrator();
        break;
      default:
        orchestrator = new QuickSearchOrchestrator();
        break;
    }

    // Combine system instructions with personalization data
    const enhancedSystemInstructions = systemInstructions(
      body.systemInstructions || '',
      {
        introduceYourself: body.introduceYourself,
        userLocation: body.userLocation,
      }
    );

    try {
      if (body.stream) {
        // Streaming response
        const streamController = new SearchStreamController();
        
        // Execute search with streaming support
        const resultPromise = orchestrator.planAndExecute(
          body.query,
          history,
          llm,
          embeddings,
          [],
          enhancedSystemInstructions,
          streamController
        );

        // Return streaming response immediately
        return createStreamingResponse(streamController.getStream());
        
      } else {
        // Non-streaming response - collect all results and return when complete
        const result = await orchestrator.planAndExecute(
          body.query,
          history,
          llm,
          embeddings,
          [],
          enhancedSystemInstructions
        );

        const persistence = await saveSearchTurn({
          sessionId: body.sessionId,
          query: body.query,
          answer: result.message,
          sources: result.sources || [],
          images: result.images || [],
          videos: result.videos || [],
        });

        return Response.json({
          sessionId: persistence.sessionId,
          persisted: persistence.saved,
          message: result.message,
          sources: result.sources,
          images: result.images,
          videos: result.videos,
          searchIntent: result.searchIntent,
          pipelineStages: result.pipelineStages,
          executionTime: result.executionTime,
          mode: result.mode,
          success: result.success,
          qsredPipeline: true,
          orchestrator: true
        }, { status: 200 });
      }

    } catch (error: any) {
      console.error('Orchestrator execution error:', error);
      return Response.json(
        { 
          message: 'Q-S-R-E-D Pipeline error', 
          error: error.message,
          qsredPipeline: true 
        },
        { status: 500 },
      );
    }
  } catch (err: any) {
    console.error(`Error in Q-S-R-E-D search pipeline: ${err.message}`);
    return Response.json(
      { 
        message: 'An error occurred in the Q-S-R-E-D search pipeline.',
        error: err.message,
        qsredPipeline: true
      },
      { status: 500 },
    );
  }
};
