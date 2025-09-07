import { Embeddings } from '@langchain/core/embeddings';
import { Document } from 'langchain/document';
import computeSimilarity from '../utils/computeSimilarity';

export interface RerankedDocument extends Document {
  relevanceScore: number;
  originalRank: number;
}

export interface RerankingConfig {
  // Relevance-first configuration - no hardcoded limits
  minRelevanceThreshold: number;
  semanticWeight: number;
  keywordWeight: number;
  qualityWeight: number;
  freshnessWeight: number;
  diversityWeight: number;
  // Adaptive thresholds based on query context
  adaptiveScoring: boolean;
}

export class NeuralReranker {
  private config: RerankingConfig;

  constructor(config: Partial<RerankingConfig> = {}) {
    this.config = {
      // Pure relevance-driven configuration
      minRelevanceThreshold: 0.3, // Only filter by minimum relevance
      semanticWeight: 0.5,        // Semantic understanding
      keywordWeight: 0.3,         // Exact keyword matches
      qualityWeight: 0.1,         // Content quality signals
      freshnessWeight: 0.05,      // Recency signals  
      diversityWeight: 0.05,      // Source diversity
      adaptiveScoring: true,      // Adapt scoring to query type
      ...config
    };
  }

  async rerankDocuments(
    query: string,
    documents: Document[],
    embeddings: Embeddings,
    fileIds: string[] = []
  ): Promise<RerankedDocument[]> {
    if (documents.length === 0) return [];

    console.log(`🧠 Pure Relevance Ranking: Processing ${documents.length} documents with adaptive scoring`);

    // Calculate all relevance signals
    const queryEmbedding = await embeddings.embedQuery(query);
    const semanticScores = await Promise.all(
      documents.map(async (doc, index) => {
        const docEmbedding = await embeddings.embedQuery(doc.pageContent);
        const similarity = computeSimilarity(queryEmbedding, docEmbedding);
        return { index, score: similarity };
      })
    );

    const keywordScores = this.calculateKeywordRelevance(query, documents);
    const qualityScores = this.calculateContentQuality(documents);
    const freshnessScores = this.calculateContentFreshness(documents);
    const diversityPenalties = this.calculateDiversityPenalties(documents);

    // Adaptive weight adjustment based on query characteristics
    const adaptiveWeights = this.config.adaptiveScoring 
      ? this.calculateAdaptiveWeights(query, documents)
      : this.config;

    console.log(`📊 Adaptive weights - Semantic: ${adaptiveWeights.semanticWeight.toFixed(2)}, Keyword: ${adaptiveWeights.keywordWeight.toFixed(2)}, Quality: ${adaptiveWeights.qualityWeight.toFixed(2)}`);

    // Calculate final relevance scores (NO LIMITS)
    const relevanceScores = semanticScores.map((semantic, i) => {
      const finalScore = 
        (semantic.score * adaptiveWeights.semanticWeight) +
        (keywordScores[i] * adaptiveWeights.keywordWeight) +
        (qualityScores[i] * adaptiveWeights.qualityWeight) +
        (freshnessScores[i] * adaptiveWeights.freshnessWeight) -
        (diversityPenalties[i] * adaptiveWeights.diversityWeight);

      return {
        index: semantic.index,
        score: Math.max(0, finalScore), // Ensure non-negative
        semanticScore: semantic.score,
        keywordScore: keywordScores[i],
        qualityScore: qualityScores[i],
        freshnessScore: freshnessScores[i],
        diversityPenalty: diversityPenalties[i]
      };
    });

    // Sort by relevance score (highest first)
    relevanceScores.sort((a, b) => b.score - a.score);

    // PURE RELEVANCE FILTERING - Only remove truly irrelevant content
    const relevantDocuments = relevanceScores.filter(doc => {
      // Dynamic threshold based on score distribution
      const scoreDistribution = relevanceScores.map(d => d.score);
      const avgScore = scoreDistribution.reduce((sum, s) => sum + s, 0) / scoreDistribution.length;
      const dynamicThreshold = Math.min(this.config.minRelevanceThreshold, avgScore * 0.5);
      
      return doc.score >= dynamicThreshold;
    });

    console.log(`🎯 Relevance filtering: ${documents.length} → ${relevantDocuments.length} documents (threshold: ${relevantDocuments.length > 0 ? (relevanceScores.map(d => d.score).reduce((sum, s) => sum + s, 0) / relevanceScores.length * 0.5).toFixed(3) : 'N/A'})`);
    console.log(`📈 Score range: ${relevantDocuments.length > 0 ? relevantDocuments[0].score.toFixed(3) : '0'} → ${relevantDocuments.length > 0 ? relevantDocuments[relevantDocuments.length - 1].score.toFixed(3) : '0'}`);

    // Convert to RerankedDocument format with rich metadata
    return relevantDocuments.map((scoreData, rank) => ({
      ...documents[scoreData.index],
      relevanceScore: scoreData.score,
      originalRank: scoreData.index,
      metadata: {
        ...documents[scoreData.index].metadata,
        relevanceScore: scoreData.score,
        semanticScore: scoreData.semanticScore,
        keywordScore: scoreData.keywordScore,
        qualityScore: scoreData.qualityScore,
        freshnessScore: scoreData.freshnessScore,
        diversityPenalty: scoreData.diversityPenalty,
        rank: rank + 1,
        totalCandidates: documents.length,
        selectionMethod: 'pure-relevance'
      }
    }));
  }

  private calculateKeywordRelevance(query: string, documents: Document[]): number[] {
    const queryTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[^\w]/g, ''));

    return documents.map(doc => {
      const content = doc.pageContent.toLowerCase();
      const title = (doc.metadata?.title || '').toLowerCase();
      
      let relevanceScore = 0;
      const uniqueMatches = new Set<string>();

      queryTerms.forEach(term => {
        // Exact term matches
        const contentMatches = (content.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        const titleMatches = (title.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        
        if (contentMatches > 0 || titleMatches > 0) {
          uniqueMatches.add(term);
          // Title matches are more valuable
          relevanceScore += (titleMatches * 0.4) + (Math.min(contentMatches, 5) * 0.1);
        }
        
        // Partial matches for longer terms
        if (term.length > 4) {
          const partialContent = content.includes(term) ? 0.05 : 0;
          const partialTitle = title.includes(term) ? 0.2 : 0;
          relevanceScore += partialContent + partialTitle;
        }
      });

      // Bonus for matching multiple query terms
      const termCoverage = uniqueMatches.size / queryTerms.length;
      relevanceScore *= (0.5 + termCoverage);

      return Math.min(relevanceScore, 1.0);
    });
  }

  private calculateContentQuality(documents: Document[]): number[] {
    return documents.map(doc => {
      const content = doc.pageContent;
      const metadata = doc.metadata || {};
      let qualityScore = 0;

      // Content substance (optimal length range)
      const length = content.length;
      if (length > 100 && length < 10000) {
        qualityScore += Math.min(0.4, length / 2500); // Scale up to 0.4
      }

      // Structural quality indicators
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
      const avgSentenceLength = sentences.length > 0 
        ? content.length / sentences.length 
        : 0;
      
      if (sentences.length > 2 && avgSentenceLength > 20 && avgSentenceLength < 200) {
        qualityScore += 0.3;
      }

      // Information density
      const words = content.split(/\s+/).length;
      const uniqueWords = new Set(content.toLowerCase().split(/\s+/)).size;
      const lexicalDiversity = words > 0 ? uniqueWords / words : 0;
      
      if (lexicalDiversity > 0.3 && lexicalDiversity < 0.9) {
        qualityScore += 0.2;
      }

      // Title quality
      const title = metadata.title || '';
      if (title.length > 10 && title.length < 200) {
        qualityScore += 0.1;
      }

      return Math.min(qualityScore, 1.0);
    });
  }

  private calculateContentFreshness(documents: Document[]): number[] {
    const currentYear = new Date().getFullYear();
    
    return documents.map(doc => {
      const content = doc.pageContent.toLowerCase();
      let freshnessScore = 0.3; // Base freshness score

      // Look for current year indicators
      if (content.includes(currentYear.toString())) {
        freshnessScore += 0.4;
      } else if (content.includes((currentYear - 1).toString())) {
        freshnessScore += 0.2;
      } else if (content.includes((currentYear - 2).toString())) {
        freshnessScore += 0.1;
      }

      // Modern indicators
      const freshTerms = ['latest', 'recent', 'new', 'updated', 'current', 'today', 'now'];
      freshTerms.forEach(term => {
        if (content.includes(term)) {
          freshnessScore += 0.05;
        }
      });

      return Math.min(freshnessScore, 1.0);
    });
  }

  private calculateDiversityPenalties(documents: Document[]): number[] {
    const domainCounts = new Map<string, number>();
    
    // First pass: count domains
    documents.forEach(doc => {
      const domain = this.extractDomain(doc.metadata?.url || '');
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    });

    return documents.map(doc => {
      const domain = this.extractDomain(doc.metadata?.url || '');
      const domainCount = domainCounts.get(domain) || 1;
      
      // Light penalty for domain over-representation (doesn't eliminate good content)
      if (domainCount > 3) {
        return 0.1; // Small penalty
      } else if (domainCount > 1) {
        return 0.05; // Very small penalty
      }
      
      return 0; // No penalty for unique domains
    });
  }

  private calculateAdaptiveWeights(query: string, documents: Document[]): RerankingConfig {
    const queryWords = query.toLowerCase().split(/\s+/);
    const queryLength = queryWords.length;
    
    // Adapt weights based on query characteristics
    let semanticWeight = this.config.semanticWeight;
    let keywordWeight = this.config.keywordWeight;
    let qualityWeight = this.config.qualityWeight;
    let freshnessWeight = this.config.freshnessWeight;
    let diversityWeight = this.config.diversityWeight;

    // Short, specific queries favor exact keyword matches
    if (queryLength <= 3) {
      keywordWeight += 0.1;
      semanticWeight -= 0.05;
    }
    
    // Long, complex queries favor semantic understanding
    if (queryLength > 6) {
      semanticWeight += 0.1;
      keywordWeight -= 0.05;
    }

    // Time-sensitive queries
    const timeIndicators = ['latest', 'recent', 'new', '2024', '2025', 'current'];
    if (timeIndicators.some(indicator => query.toLowerCase().includes(indicator))) {
      freshnessWeight += 0.1;
      qualityWeight -= 0.05;
    }

    // Technical queries favor quality
    const technicalIndicators = ['how', 'what', 'why', 'explain', 'guide', 'tutorial'];
    if (technicalIndicators.some(indicator => query.toLowerCase().includes(indicator))) {
      qualityWeight += 0.1;
      diversityWeight -= 0.02;
    }

    return {
      ...this.config,
      semanticWeight: Math.max(0.1, semanticWeight),
      keywordWeight: Math.max(0.1, keywordWeight),
      qualityWeight: Math.max(0, qualityWeight),
      freshnessWeight: Math.max(0, freshnessWeight),
      diversityWeight: Math.max(0, diversityWeight)
    };
  }

  private perplexityStyleSelection(
    documents: Document[],
    scoredDocuments: Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }>,
    query: string
  ): Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }> {
    const selected: Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }> = [];
    const usedDomains = new Set<string>();
    const queryLower = query.toLowerCase();
    
    // Phase 1: Always include the top-scoring document
    if (scoredDocuments.length > 0) {
      selected.push(scoredDocuments[0]);
      const topDomain = this.extractDomain(documents[scoredDocuments[0].index].metadata?.url || '');
      usedDomains.add(topDomain);
    }
    
    // Phase 2: Add high-quality documents with diversity
    for (const scoreData of scoredDocuments.slice(1)) {
      if (selected.length >= 15) break; // Reasonable upper limit
      
      const doc = documents[scoreData.index];
      const domain = this.extractDomain(doc.metadata?.url || '');
      
      // Pure relevance and quality gates - no arbitrary thresholds
      const hasSubstantialContent = doc.pageContent.length > 50;
      const isDiverse = !usedDomains.has(domain) || usedDomains.size < 5;
      
      // Relevance boost for query-specific content
      const isHighlyRelevant = doc.pageContent.toLowerCase().includes(queryLower) ||
                              (doc.metadata?.title || '').toLowerCase().includes(queryLower);
      
      if (hasSubstantialContent && (isDiverse || isHighlyRelevant || scoreData.score > 0.7)) {
        selected.push(scoreData);
        usedDomains.add(domain);
      }
    }
    
    // Phase 3: Fill remaining slots with best available (if we have few results)
    if (selected.length < 6) {
      for (const scoreData of scoredDocuments) {
        if (selected.length >= 20) break; // Dynamic upper limit
        if (!selected.find(s => s.index === scoreData.index) && scoreData.score > 0) {
          selected.push(scoreData);
        }
      }
    }
    
    console.log(`🎯 Perplexity-style selection: ${scoredDocuments.length} → ${selected.length} documents (${usedDomains.size} unique domains)`);
    return selected;
  }

  private applyAdvancedDiversityBoost(
    documents: Document[], 
    scores: Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }>
  ): Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }> {
    const result: Array<{ index: number; score: number; baseScore: number; qualityScore: number; freshnessScore: number; lengthScore: number }> = [];
    const domainCounts = new Map<string, number>();
    const topicKeywords = new Set<string>();
    
    // Analyze topics from top documents
    scores.slice(0, 5).forEach(score => {
      const doc = documents[score.index];
      const words = doc.pageContent.toLowerCase().split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 20);
      words.forEach(word => topicKeywords.add(word));
    });
    
    // Advanced diversity scoring
    for (const scoreData of scores) {
      const doc = documents[scoreData.index];
      const domain = this.extractDomain(doc.metadata?.url || '');
      const domainCount = domainCounts.get(domain) || 0;
      
      // Diversity penalty for overrepresented domains
      let diversityMultiplier = 1.0;
      if (domainCount > 0) {
        diversityMultiplier = Math.max(0.5, 1.0 - (domainCount * 0.2));
      }
      
      // Topic diversity bonus
      const docWords = new Set(doc.pageContent.toLowerCase().split(/\s+/));
      const topicOverlap = [...topicKeywords].filter(keyword => docWords.has(keyword)).length;
      const topicDiversityBonus = topicOverlap < 5 ? 1.1 : 1.0;
      
      const adjustedScore = {
        ...scoreData,
        score: scoreData.score * diversityMultiplier * topicDiversityBonus
      };
      
      result.push(adjustedScore);
      domainCounts.set(domain, domainCount + 1);
    }
    
    // Re-sort by adjusted scores
    result.sort((a, b) => b.score - a.score);
    return result;
  }

  private applyDiversityBoost(
    documents: Document[], 
    scores: Array<{ index: number; score: number }>
  ): Array<{ index: number; score: number }> {
    const result: Array<{ index: number; score: number }> = [];
    const usedDomains = new Set<string>();
    
    // First pass: add high-scoring documents from different domains
    scores.forEach(score => {
      const doc = documents[score.index];
      const domain = this.extractDomain(doc.metadata?.url || '');
      
      if (!usedDomains.has(domain) || result.length < 10) {
        result.push(score);
        usedDomains.add(domain);
      }
    });
    
    // Second pass: add remaining high-scoring documents
    scores.forEach(score => {
      if (!result.find(r => r.index === score.index)) {
        result.push(score);
      }
    });
    
    return result;
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  updateConfig(newConfig: Partial<RerankingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

