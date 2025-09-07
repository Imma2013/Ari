import { SearchOrchestrator } from './orchestrator';
import { getSearchConfig } from './config';
import { SearchStreamController } from '../utils/streaming';

// Create optimized search orchestrator instances with streaming architecture
const quickSearch = new SearchOrchestrator(getSearchConfig('quick'));
const proSearch = new SearchOrchestrator(getSearchConfig('pro'));
const ultraSearch = new SearchOrchestrator(getSearchConfig('ultra'));

console.log('⚡ Initialized search orchestrators with real-time streaming architecture');

export const orchestratorHandlers: Record<string, SearchOrchestrator> = {
  quickSearch,
  proSearch,
  ultraSearch,
};

// Export instances for direct access
export { quickSearch, proSearch, ultraSearch };