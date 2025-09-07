import { OrchestratorConfig } from './orchestrator';
import { SearchIntent } from './intentDetection';

// Dynamic configuration system that adapts based on search intent
export const getSearchConfig = (mode: 'quick' | 'pro' | 'ultra', intent?: SearchIntent): OrchestratorConfig => {
  const baseConfig = {
    rerankingConfig: {
      // Intent-driven relevance threshold - dynamic based on search strategy
      minRelevanceThreshold: intent?.recommendations.relevanceThreshold ?? getDefaultRelevanceThreshold(mode, intent),
      semanticWeight: 0.5,
      keywordWeight: 0.3,
      qualityWeight: 0.1,
      freshnessWeight: getFreshnessWeight(intent),
      diversityWeight: getDiversityWeight(intent),
      adaptiveScoring: true, // Always use adaptive weights
    },
    fusionConfig: {
      semanticGrouping: true,
      deduplication: true,
      skipEnhancement: false,
      batchSize: 3,
      enableParallelProcessing: true,
    },
  };

  // Dynamic configuration based on mode and intent
  const intentTimeoutMultiplier = intent?.recommendations.timeoutMultiplier ?? 1.0;
  const intentSearchQueries = intent?.recommendations.searchQueries ?? getDefaultSearchQueries(mode);
  const intentSearchDepth = intent?.recommendations.searchDepth ?? 'medium';

  switch (mode) {
    case 'quick':
      return {
        mode: 'quick',
        // No artificial limits - let relevance and intent guide results
        maxSources: 200, // High ceiling, relevance filters will limit
        maxImages: 200, 
        maxVideos: 200, 
        timeoutConfig: {
          queryTimeout: Math.floor(500 * intentTimeoutMultiplier),
          searchTimeout: Math.floor(3000 * intentTimeoutMultiplier),
          rerankTimeout: Math.floor(1200 * intentTimeoutMultiplier),
          responseTimeout: Math.floor(8000 * intentTimeoutMultiplier),
          totalTimeout: Math.floor(15000 * intentTimeoutMultiplier),
        },
        searchConfig: {
          maxQueries: intentSearchQueries,
          parallelSearches: intent?.recommendations.parallelization ?? true,
          batchSize: getBatchSize(intentSearchDepth, 'quick'),
        },
        streamingConfig: {
          enableStreaming: true,
          minSourcesForResponse: 5,
          maxResponseDelay: 100,
          progressiveEnhancement: true,
          earlyTermination: false,
          parallelProcessing: true,
        },
        rerankingConfig: baseConfig.rerankingConfig,
        fusionConfig: {
          ...baseConfig.fusionConfig,
          maxChunkSize: getChunkSize(intentSearchDepth, 'quick'),
          overlapSize: 80,
          maxChunks: getMaxChunks(intentSearchDepth, 'quick'),
          skipEnhancement: true, // Skip for speed in quick mode
          batchSize: 3,
          enableParallelProcessing: false,
        },
      };

    case 'pro':
      return {
        mode: 'pro',
        // No artificial limits - let relevance and intent guide results
        maxSources: 300,
        maxImages: 300,
        maxVideos: 300,
        timeoutConfig: {
          queryTimeout: Math.floor(800 * intentTimeoutMultiplier),
          searchTimeout: Math.floor(4500 * intentTimeoutMultiplier),
          rerankTimeout: Math.floor(2000 * intentTimeoutMultiplier),
          responseTimeout: Math.floor(10000 * intentTimeoutMultiplier),
          totalTimeout: Math.floor(18000 * intentTimeoutMultiplier),
        },
        searchConfig: {
          maxQueries: intentSearchQueries,
          parallelSearches: intent?.recommendations.parallelization ?? true,
          batchSize: getBatchSize(intentSearchDepth, 'pro'),
        },
        streamingConfig: {
          enableStreaming: true,
          minSourcesForResponse: 8,
          maxResponseDelay: 150,
          progressiveEnhancement: true,
          earlyTermination: false,
          parallelProcessing: true,
        },
        rerankingConfig: baseConfig.rerankingConfig,
        fusionConfig: {
          ...baseConfig.fusionConfig,
          maxChunkSize: getChunkSize(intentSearchDepth, 'pro'),
          overlapSize: 120,
          maxChunks: getMaxChunks(intentSearchDepth, 'pro'),
          skipEnhancement: false, // Enable batched enhancement
          batchSize: 4,
          enableParallelProcessing: true,
        },
      };

    case 'ultra':
      return {
        mode: 'ultra',
        // No artificial limits - let relevance and intent guide results
        maxSources: 500,
        maxImages: 400,
        maxVideos: 400,
        timeoutConfig: {
          queryTimeout: Math.floor(1200 * intentTimeoutMultiplier),
          searchTimeout: Math.floor(6000 * intentTimeoutMultiplier),
          rerankTimeout: Math.floor(3500 * intentTimeoutMultiplier),
          responseTimeout: Math.floor(12000 * intentTimeoutMultiplier),
          totalTimeout: Math.floor(25000 * intentTimeoutMultiplier),
        },
        searchConfig: {
          maxQueries: Math.min(intentSearchQueries + 1, 8), // Ultra can use more queries
          parallelSearches: intent?.recommendations.parallelization ?? true,
          batchSize: getBatchSize(intentSearchDepth, 'ultra'),
        },
        streamingConfig: {
          enableStreaming: true,
          minSourcesForResponse: 10,
          maxResponseDelay: 200,
          progressiveEnhancement: true,
          earlyTermination: true, // Ultra mode can use early termination
          parallelProcessing: true,
        },
        rerankingConfig: baseConfig.rerankingConfig,
        fusionConfig: {
          ...baseConfig.fusionConfig,
          maxChunkSize: getChunkSize(intentSearchDepth, 'ultra'),
          overlapSize: 200,
          maxChunks: getMaxChunks(intentSearchDepth, 'ultra'),
          skipEnhancement: false, // Enable full enhancement for quality
          batchSize: 3, // Smaller batches for better quality
          enableParallelProcessing: true,
        },
      };

    default:
      throw new Error(`Unknown search mode: ${mode}`);
  }
};

// Helper functions for intent-driven configuration

function getDefaultRelevanceThreshold(mode: 'quick' | 'pro' | 'ultra', intent?: SearchIntent): number {
  if (intent?.strategy === 'quickAnswer') return 0.6; // High threshold for quick answers
  if (intent?.strategy === 'research') return 0.25; // Lower threshold for research
  if (intent?.strategy === 'news') return 0.4; // Medium threshold for news
  if (intent?.strategy === 'comparison') return 0.35; // Lower threshold for comparisons
  
  // Mode-based defaults
  switch (mode) {
    case 'quick': return 0.5;
    case 'pro': return 0.4;
    case 'ultra': return 0.3;
  }
}

function getFreshnessWeight(intent?: SearchIntent): number {
  if (intent?.temporal === 'current') return 0.2; // High weight for current info
  if (intent?.temporal === 'trending') return 0.15;
  if (intent?.strategy === 'news') return 0.25; // News needs fresh content
  return 0.05; // Default low freshness weight
}

function getDiversityWeight(intent?: SearchIntent): number {
  if (intent?.strategy === 'research') return 0.15; // Research benefits from diversity
  if (intent?.strategy === 'comparison') return 0.12; // Comparisons need variety
  if (intent?.complexity === 'complex') return 0.1;
  return 0.05; // Default low diversity weight
}

function getDefaultSearchQueries(mode: 'quick' | 'pro' | 'ultra'): number {
  switch (mode) {
    case 'quick': return 3;
    case 'pro': return 4;
    case 'ultra': return 5;
  }
}

function getMinSourcesForStrategy(strategy?: SearchIntent['strategy']): number {
  if (strategy === 'quickAnswer') return 2; // Quick answers need fewer sources
  if (strategy === 'research') return 4; // Research needs more sources
  if (strategy === 'comparison') return 3; // Comparisons need multiple perspectives
  return 3; // Default
}

function getBatchSize(depth: 'shallow' | 'medium' | 'deep', mode: 'quick' | 'pro' | 'ultra'): number {
  const baseSize = mode === 'quick' ? 20 : mode === 'pro' ? 25 : 30;
  
  if (depth === 'shallow') return Math.floor(baseSize * 0.8);
  if (depth === 'deep') return Math.floor(baseSize * 1.3);
  return baseSize;
}

function getChunkSize(depth: 'shallow' | 'medium' | 'deep', mode: 'quick' | 'pro' | 'ultra'): number {
  const baseSize = mode === 'quick' ? 600 : mode === 'pro' ? 800 : 1000;
  
  if (depth === 'shallow') return Math.floor(baseSize * 0.7);
  if (depth === 'deep') return Math.floor(baseSize * 1.4);
  return baseSize;
}

function getMaxChunks(depth: 'shallow' | 'medium' | 'deep', mode: 'quick' | 'pro' | 'ultra'): number {
  const baseChunks = mode === 'quick' ? 4 : mode === 'pro' ? 6 : 8;
  
  if (depth === 'shallow') return Math.max(baseChunks - 1, 2);
  if (depth === 'deep') return baseChunks + 2;
  return baseChunks;
}
