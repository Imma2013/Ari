import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { BaseMessage } from '@langchain/core/messages';
import { SearchOrchestrator, SearchResult } from './orchestrator';
import { getSearchConfig } from './config';
import { IntentDetector } from './intentDetection';
import { SearchStreamController, SearchStreamData } from '../utils/streaming';

export interface SearchOrchestratorType {
  planAndExecute: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    fileIds: string[],
    systemInstructions: string,
    streamController?: SearchStreamController,
  ) => Promise<SearchResult>;
}

// Ultra-optimized Quick Search with intelligent intent detection and real-time streaming
class QuickSearchOrchestrator implements SearchOrchestratorType {
  private orchestrator: SearchOrchestrator;

  constructor() {
    // Start with base config, will be enhanced with intent
    this.orchestrator = new SearchOrchestrator(getSearchConfig('quick'));
  }

  async planAndExecute(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    fileIds: string[],
    systemInstructions: string,
    streamController?: SearchStreamController,
  ): Promise<SearchResult> {
    console.log('⚡ Ultra-optimized QuickSearch: Analyzing intent and starting adaptive search...');
    
    // Detect intent first to optimize configuration
    const intentDetector = new IntentDetector(llm);
    const searchIntent = await intentDetector.detectIntent(message);
    
    console.log(`🎯 QuickSearch Intent: ${searchIntent.strategy} (${searchIntent.complexity}) - ${searchIntent.reasoning}`);
    
    // Reconfigure orchestrator based on detected intent
    const intentOptimizedConfig = getSearchConfig('quick', searchIntent);
    this.orchestrator = new SearchOrchestrator(intentOptimizedConfig, streamController);
    
    // Execute with intent-optimized configuration
    return this.orchestrator.executeSearch(
      message,
      history,
      llm,
      embeddings,
      fileIds,
      systemInstructions
    );
  }
}

export default QuickSearchOrchestrator;
export { QuickSearchOrchestrator };
