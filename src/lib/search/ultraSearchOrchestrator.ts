import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { BaseMessage } from '@langchain/core/messages';
import { SearchOrchestrator, SearchResult } from './orchestrator';
import { SearchOrchestratorType } from './quickSearchOrchestrator';
import { getSearchConfig } from './config';
import { IntentDetector } from './intentDetection';
import { SearchStreamController, SearchStreamData } from '../utils/streaming';

// Ultra-optimized Ultra Search with maximum depth and intelligent resource allocation
class UltraSearchOrchestrator implements SearchOrchestratorType {
  private orchestrator: SearchOrchestrator;

  constructor() {
    this.orchestrator = new SearchOrchestrator(getSearchConfig('ultra'));
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
    console.log('⚡ Ultra-optimized UltraSearch: Deep intent analysis for exhaustive search...');
    
    // Comprehensive intent detection for maximum depth
    const intentDetector = new IntentDetector(llm);
    const searchIntent = await intentDetector.detectIntent(message);
    
    console.log(`🎯 UltraSearch Intent: ${searchIntent.strategy} (${searchIntent.complexity}) - Queries: ${searchIntent.recommendations.searchQueries}, Timeout: ${searchIntent.recommendations.timeoutMultiplier}x`);
    
    // Ultra-level configuration with maximum intent optimization
    const intentOptimizedConfig = getSearchConfig('ultra', searchIntent);
    this.orchestrator = new SearchOrchestrator(intentOptimizedConfig, streamController);
    
    // Execute with maximum search depth and capabilities
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

export default UltraSearchOrchestrator;
