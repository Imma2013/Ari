import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';

export interface SearchIntent {
  // Search Strategy - determines how to approach the search
  strategy: 'quickAnswer' | 'research' | 'comparison' | 'tutorial' | 'news' | 'reference' | 'creative';
  
  // Query Complexity - determines search depth and resource allocation
  complexity: 'simple' | 'medium' | 'complex';
  
  // Temporal Requirements - determines freshness and time-based filtering
  temporal: 'current' | 'historical' | 'trending' | 'timeless';
  
  // Content Preferences - secondary to strategy, used for result enhancement
  contentPreferences: {
    needsImages: boolean;
    needsVideos: boolean;
    mediaImportance: 'low' | 'medium' | 'high';
    visualLearning: boolean;
  };
  
  // Confidence scores for each dimension
  confidence: {
    strategy: number;
    complexity: number;
    temporal: number;
    contentPreferences: number;
  };
  
  // Reasoning and recommendations for orchestrator
  reasoning: string;
  recommendations: {
    searchQueries: number; // How many search queries to generate
    searchDepth: 'shallow' | 'medium' | 'deep';
    parallelization: boolean;
    earlyTermination: boolean;
    relevanceThreshold: number;
    timeoutMultiplier: number; // Adjust timeouts based on complexity
  };
  
  // Legacy compatibility (will be removed)
  primaryIntent: 'documents' | 'images' | 'videos' | 'mixed';
  needsImages: boolean;
  needsVideos: boolean;
}

export class IntentDetector {
  private static readonly INTENT_DETECTION_PROMPT = `You are an advanced search intent analyzer. Analyze the user query comprehensively across multiple dimensions to determine the optimal search strategy.

ANALYSIS DIMENSIONS:

1. **SEARCH STRATEGY** (determines approach):
   - quickAnswer: Simple factual queries, definitions, basic questions
   - research: Deep investigative queries, complex topics, academic research
   - comparison: Comparing products, concepts, options ("X vs Y", "best X")  
   - tutorial: Learning, how-to guides, step-by-step instructions
   - news: Current events, breaking news, recent developments
   - reference: Technical specs, documentation, detailed information
   - creative: Brainstorming, inspiration, creative ideas

2. **QUERY COMPLEXITY** (determines depth):
   - simple: Single concept, clear question, basic information need
   - medium: Multiple related concepts, requires synthesis
   - complex: Multi-faceted, ambiguous, requires deep exploration

3. **TEMPORAL REQUIREMENTS** (determines freshness needs):
   - current: Latest information, real-time data, breaking news
   - historical: Past events, archived information, timeline data
   - trending: Popular recent content, viral information
   - timeless: General knowledge, concepts that don't change

4. **CONTENT PREFERENCES** (enhances results):
   - Visual learning indicators (charts, diagrams helpful)
   - Media importance (videos crucial vs supplementary)
   - Image necessity (visual content primary vs secondary)

Query: "{query}"

Respond with valid JSON:
{
  "strategy": "quickAnswer|research|comparison|tutorial|news|reference|creative",
  "complexity": "simple|medium|complex", 
  "temporal": "current|historical|trending|timeless",
  "contentPreferences": {
    "needsImages": boolean,
    "needsVideos": boolean,
    "mediaImportance": "low|medium|high",
    "visualLearning": boolean
  },
  "confidence": {
    "strategy": number (0-1),
    "complexity": number (0-1),
    "temporal": number (0-1),
    "contentPreferences": number (0-1)
  },
  "reasoning": "Brief analysis explanation",
  "recommendations": {
    "searchQueries": number (1-6),
    "searchDepth": "shallow|medium|deep",
    "parallelization": boolean,
    "earlyTermination": boolean,
    "relevanceThreshold": number (0.2-0.8),
    "timeoutMultiplier": number (0.5-2.0)
  }
}

Examples:
- "What is quantum computing" → quickAnswer, simple, timeless, low media
- "How to bake chocolate cake" → tutorial, medium, timeless, high media (visual learning)
- "iPhone 15 vs Samsung Galaxy S24" → comparison, medium, current, medium media
- "Latest AI developments 2024" → news, medium, current, medium media
- "Climate change research papers" → research, complex, current, low media
- "Show me Eiffel Tower photos" → reference, simple, timeless, high media (images primary)

Analyze and respond with valid JSON only.`;

  constructor(private llm: BaseChatModel) {}

  async detectIntent(query: string): Promise<SearchIntent> {
    if (!query || query.trim().length === 0) {
      return IntentDetector.getQuickIntent(query);
    }

    try {
      return await this.getLLMIntent(query);
    } catch (error) {
      console.error('LLM intent detection failed:', error);
      console.log('Falling back to heuristic intent detection');
      return IntentDetector.getQuickIntent(query);
    }
  }

  private async getLLMIntent(query: string): Promise<SearchIntent> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    const prompt = IntentDetector.INTENT_DETECTION_PROMPT.replace('{query}', query);
    
    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const content = response.content as string;
      
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const intent = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!intent.strategy || !intent.complexity || !intent.temporal || !intent.contentPreferences) {
        throw new Error('Invalid intent structure');
      }

      return {
        strategy: intent.strategy,
        complexity: intent.complexity,
        temporal: intent.temporal,
        contentPreferences: {
          needsImages: intent.contentPreferences.needsImages || false,
          needsVideos: intent.contentPreferences.needsVideos || false,
          mediaImportance: intent.contentPreferences.mediaImportance || 'low',
          visualLearning: intent.contentPreferences.visualLearning || false,
        },
        confidence: {
          strategy: intent.confidence?.strategy || 0.7,
          complexity: intent.confidence?.complexity || 0.7,
          temporal: intent.confidence?.temporal || 0.7,
          contentPreferences: intent.confidence?.contentPreferences || 0.7,
        },
        reasoning: intent.reasoning || 'LLM-based comprehensive analysis',
        recommendations: {
          searchQueries: Math.min(Math.max(intent.recommendations?.searchQueries || 3, 1), 6),
          searchDepth: intent.recommendations?.searchDepth || 'medium',
          parallelization: intent.recommendations?.parallelization !== false,
          earlyTermination: intent.recommendations?.earlyTermination !== false,
          relevanceThreshold: Math.min(Math.max(intent.recommendations?.relevanceThreshold || 0.4, 0.2), 0.8),
          timeoutMultiplier: Math.min(Math.max(intent.recommendations?.timeoutMultiplier || 1.0, 0.5), 2.0),
        },
        // Legacy compatibility
        primaryIntent: this.mapToPrimaryIntent(intent.strategy, intent.contentPreferences),
        needsImages: intent.contentPreferences.needsImages || false,
        needsVideos: intent.contentPreferences.needsVideos || false,
      };
    } catch (error) {
      console.error('Error parsing LLM intent response:', error);
      throw error;
    }
  }

  private mapToPrimaryIntent(strategy: string, contentPreferences: any): 'documents' | 'images' | 'videos' | 'mixed' {
    if (contentPreferences.mediaImportance === 'high') {
      if (contentPreferences.needsImages && contentPreferences.needsVideos) return 'mixed';
      if (contentPreferences.needsImages) return 'images';
      if (contentPreferences.needsVideos) return 'videos';
    }
    
    // Strategy-based mapping
    if (strategy === 'tutorial' && contentPreferences.visualLearning) return 'mixed';
    if (strategy === 'reference' && contentPreferences.needsImages) return 'images';
    
    return 'documents';
  }

  static getQuickIntent(query: string): SearchIntent {
    const queryLower = query.toLowerCase();
    
    // Strategy detection keywords
    const strategyKeywords = {
      quickAnswer: ['what is', 'define', 'explain', 'definition', 'meaning'],
      research: ['research', 'study', 'analysis', 'comprehensive', 'detailed', 'academic'],
      comparison: ['vs', 'versus', 'compare', 'comparison', 'difference', 'better', 'best'],
      tutorial: ['how to', 'tutorial', 'guide', 'step', 'learn', 'teach', 'instructions'],
      news: ['news', 'latest', 'recent', 'breaking', 'update', 'current events', 'today'],
      reference: ['specs', 'specification', 'documentation', 'manual', 'technical', 'details'],
      creative: ['ideas', 'inspiration', 'creative', 'brainstorm', 'suggest', 'examples']
    };
    
    // Complexity detection
    const complexityIndicators = {
      simple: queryLower.split(' ').length < 4,
      complex: queryLower.includes('and') || queryLower.includes('or') || queryLower.includes('but') || 
               queryLower.split(' ').length > 8
    };
    
    // Temporal detection
    const temporalKeywords = {
      current: ['latest', 'recent', 'now', 'today', '2024', '2025', 'current', 'new'],
      historical: ['history', 'past', 'historical', 'ancient', 'old', 'traditional'],
      trending: ['trending', 'viral', 'popular', 'hot', 'buzz'],
    };
    
    // Content preference detection
    const imageKeywords = ['image', 'picture', 'photo', 'visual', 'show me', 'looks like', 'appearance'];
    const videoKeywords = ['video', 'watch', 'tutorial', 'demonstration', 'movie', 'clip'];
    const visualLearningKeywords = ['how to', 'tutorial', 'guide', 'demonstration', 'example'];
    
    // Determine strategy
    let strategy: SearchIntent['strategy'] = 'quickAnswer';
    let strategyScore = 0;
    
    Object.entries(strategyKeywords).forEach(([key, keywords]) => {
      const score = keywords.filter(keyword => queryLower.includes(keyword)).length;
      if (score > strategyScore) {
        strategy = key as SearchIntent['strategy'];
        strategyScore = score;
      }
    });
    
    // Determine complexity
    let complexity: SearchIntent['complexity'] = 'medium';
    if (complexityIndicators.simple) complexity = 'simple';
    else if (complexityIndicators.complex) complexity = 'complex';
    
    // Determine temporal requirement
    let temporal: SearchIntent['temporal'] = 'timeless';
    let temporalScore = 0;
    
    Object.entries(temporalKeywords).forEach(([key, keywords]) => {
      const score = keywords.filter(keyword => queryLower.includes(keyword)).length;
      if (score > temporalScore) {
        temporal = key as SearchIntent['temporal'];
        temporalScore = score;
      }
    });
    
    // Determine content preferences
    const needsImages = imageKeywords.some(keyword => queryLower.includes(keyword));
    const needsVideos = videoKeywords.some(keyword => queryLower.includes(keyword));
    const visualLearning = visualLearningKeywords.some(keyword => queryLower.includes(keyword));
    
    let mediaImportance: 'low' | 'medium' | 'high' = 'low';
    if (needsImages || needsVideos) mediaImportance = 'medium';
    if (visualLearning) mediaImportance = 'high';
    
    // Check if strategy is tutorial-related
    const tutorialStrategies: SearchIntent['strategy'][] = ['tutorial'];
    if (tutorialStrategies.includes(strategy)) {
      mediaImportance = 'high';
    }
    
    // Generate recommendations based on analysis
    const recommendations = {
      searchQueries: complexity === 'simple' ? 2 : complexity === 'medium' ? 3 : 4,
      searchDepth: complexity === 'simple' ? 'shallow' as const : 
                  complexity === 'medium' ? 'medium' as const : 'deep' as const,
      parallelization: true,
      earlyTermination: strategy === 'quickAnswer' && complexity === 'simple',
      relevanceThreshold: strategy === 'quickAnswer' ? 0.5 : 
                         strategy === 'research' ? 0.3 : 0.4,
      timeoutMultiplier: complexity === 'simple' ? 0.8 : 
                        complexity === 'complex' ? 1.5 : 1.0,
    };
    
    const reasoning = `Heuristic analysis: strategy=${strategy} (score=${strategyScore}), complexity=${complexity}, temporal=${temporal} (score=${temporalScore}), media=${mediaImportance}`;
    
    return {
      strategy,
      complexity,
      temporal,
      contentPreferences: {
        needsImages,
        needsVideos,
        mediaImportance,
        visualLearning,
      },
      confidence: {
        strategy: strategyScore > 0 ? 0.7 : 0.5,
        complexity: 0.6,
        temporal: temporalScore > 0 ? 0.7 : 0.5,
        contentPreferences: 0.6,
      },
      reasoning,
      recommendations,
      // Legacy compatibility
      primaryIntent: needsImages && needsVideos ? 'mixed' : 
                    needsImages ? 'images' : 
                    needsVideos ? 'videos' : 'documents',
      needsImages,
      needsVideos,
    };
  }
}
