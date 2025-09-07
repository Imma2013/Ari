import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { BaseMessage } from '@langchain/core/messages';
import { SearchOrchestrator, SearchResult } from './orchestrator';
import { SearchOrchestratorType } from './quickSearchOrchestrator';
import { getSearchConfig } from './config';
import { IntentDetector } from './intentDetection';
import { SearchStreamController, SearchStreamData } from '../utils/streaming';

// Ultra-optimized Pro Search with balanced speed/depth and intelligent adaptation
class ProSearchOrchestrator implements SearchOrchestratorType {
  private orchestrator: SearchOrchestrator;

  constructor() {
    this.orchestrator = new SearchOrchestrator(getSearchConfig('pro'));
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
    console.log('⚡ Ultra-optimized ProSearch: Analyzing intent for balanced comprehensive search...');
    
    // Advanced intent detection for balanced approach
    const intentDetector = new IntentDetector(llm);
    const searchIntent = await intentDetector.detectIntent(message);
    
    console.log(`🎯 ProSearch Intent: ${searchIntent.strategy} (${searchIntent.complexity}) - Depth: ${searchIntent.recommendations.searchDepth}`);
    
    // Configure with pro-level settings enhanced by intent
    const intentOptimizedConfig = getSearchConfig('pro', searchIntent);
    this.orchestrator = new SearchOrchestrator(intentOptimizedConfig, streamController);
    
    // Execute with enhanced pro search capabilities
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

export default ProSearchOrchestrator;
