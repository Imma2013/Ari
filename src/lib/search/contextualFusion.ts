import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Document } from 'langchain/document';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RerankedDocument } from './neuralReranker';

export interface FusionConfig {
  maxChunkSize: number;
  overlapSize: number;
  maxChunks: number;
  semanticGrouping: boolean;
  deduplication: boolean;
  skipEnhancement: boolean;
  batchSize: number;
  enableParallelProcessing: boolean;
}

export interface ContextChunk {
  id: string;
  content: string;
  sources: string[];
  relevanceScore: number;
  metadata: Record<string, any>;
}

export class ContextualFusion {
  private config: FusionConfig;
  private chunkCache: Map<string, ContextChunk[]> = new Map();
  private groupingCache: Map<string, RerankedDocument[]> = new Map();

  constructor(config: Partial<FusionConfig> = {}) {
    this.config = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxChunks: 10,
      semanticGrouping: true,
      deduplication: true,
      skipEnhancement: false,
      batchSize: 3,
      enableParallelProcessing: true,
      ...config
    };
  }

  async createContextChunks(
    query: string,
    documents: RerankedDocument[],
    llm: BaseChatModel,
    progressCallback?: (progress: number, stage: string) => void
  ): Promise<ContextChunk[]> {
    if (documents.length === 0) return [];

    const startTime = Date.now();
    console.log(`🚀 ContextualFusion: Starting chunk creation for ${documents.length} documents`);

    // Progress tracking
    const reportProgress = (progress: number, stage: string) => {
      if (progressCallback) progressCallback(progress, stage);
    };

    // Check cache first
    const cacheKey = `${query}-${documents.length}-${JSON.stringify(this.config)}`;
    const cached = this.chunkCache.get(cacheKey);
    if (cached) {
      console.log(`✅ ContextualFusion: Using cached chunks (${cached.length} chunks)`);
      reportProgress(100, 'Cache hit - chunks ready');
      return cached;
    }

    reportProgress(10, 'Preparing documents');

    // Fast processing - limit documents for speed
    const maxDocs = Math.min(documents.length, this.config.maxChunks * 3);
    const topDocs = documents.slice(0, maxDocs);
    console.log(`📊 ContextualFusion: Processing ${topDocs.length}/${documents.length} documents`);

    reportProgress(20, 'Grouping documents');

    // Step 1: Fast semantic grouping if enabled
    let groupedDocs = topDocs;
    if (this.config.semanticGrouping && topDocs.length > 5) {
      const groupKey = `group-${topDocs.map(d => d.metadata?.url || '').join('-')}`;
      const cachedGroup = this.groupingCache.get(groupKey);
      if (cachedGroup) {
        groupedDocs = cachedGroup;
      } else {
        const groupStartTime = Date.now();
        groupedDocs = await this.fastGroupDocuments(topDocs);
        this.groupingCache.set(groupKey, groupedDocs);
        console.log(`📊 ContextualFusion: Fast grouping completed in ${Date.now() - groupStartTime}ms`);
      }
    }

    reportProgress(40, 'Creating chunks');

    // Step 2: Create overlapping chunks with better performance
    const chunkStartTime = Date.now();
    const chunks = this.createOverlappingChunksOptimized(groupedDocs);
    console.log(`📊 ContextualFusion: Chunk creation completed in ${Date.now() - chunkStartTime}ms (${chunks.length} chunks)`);

    reportProgress(60, 'Deduplicating');

    // Step 3: Deduplicate if enabled
    let finalChunks = chunks;
    if (this.config.deduplication) {
      const dedupStartTime = Date.now();
      finalChunks = this.deduplicateChunks(chunks);
      console.log(`📊 ContextualFusion: Deduplication completed in ${Date.now() - dedupStartTime}ms (${finalChunks.length}/${chunks.length} chunks)`);
    }

    reportProgress(70, 'Limiting chunks');

    // Step 4: Limit to max chunks
    finalChunks = finalChunks.slice(0, this.config.maxChunks);

    reportProgress(80, 'Enhancing chunks');

    // Step 5: Enhanced chunk processing (conditional and optimized)
    const enhanceStartTime = Date.now();
    let enhancedChunks: ContextChunk[];
    
    if (this.config.skipEnhancement) {
      console.log(`⚡ ContextualFusion: Skipping LLM enhancement for faster processing`);
      enhancedChunks = finalChunks;
      reportProgress(100, 'Chunks ready (enhancement skipped)');
    } else {
      console.log(`🧠 ContextualFusion: Starting batched LLM enhancement for ${finalChunks.length} chunks`);
      enhancedChunks = await this.enhanceChunksWithContextBatched(query, finalChunks, llm, reportProgress);
      console.log(`✅ ContextualFusion: LLM enhancement completed in ${Date.now() - enhanceStartTime}ms`);
    }

    // Cache the result
    this.chunkCache.set(cacheKey, enhancedChunks);

    const totalTime = Date.now() - startTime;
    console.log(`✅ ContextualFusion: Total processing completed in ${totalTime}ms (${enhancedChunks.length} final chunks)`);
    reportProgress(100, `Chunks ready (${enhancedChunks.length} chunks, ${totalTime}ms)`);

    return enhancedChunks;
  }

  private async fastGroupDocuments(documents: RerankedDocument[]): Promise<RerankedDocument[]> {
    // Fast grouping based on URL domains and titles without LLM
    const groups: Map<string, RerankedDocument[]> = new Map();
    
    documents.forEach(doc => {
      const domain = this.extractDomain(doc.metadata?.url || '');
      const titleWords = (doc.metadata?.title || '').toLowerCase().split(' ').slice(0, 3).join(' ');
      const groupKey = `${domain}-${titleWords}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(doc);
    });

    // Return best document from each group
    const groupedDocs: RerankedDocument[] = [];
    groups.forEach(group => {
      // Sort by relevance and take the best
      group.sort((a, b) => b.relevanceScore - a.relevanceScore);
      groupedDocs.push(group[0]);
    });

    return groupedDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private async groupDocumentsBySemanticSimilarity(
    documents: RerankedDocument[],
    llm: BaseChatModel
  ): Promise<RerankedDocument[]> {
    if (documents.length <= 1) return documents;

    const prompt = ChatPromptTemplate.fromTemplate(`
      Analyze the following documents and group them by semantic similarity.
      Return a JSON array where each group contains document indices that are semantically related.
      
      Documents:
      {documents}
      
      Return only the JSON array, no other text.
    `);

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser()
    ]);

    try {
      const documentsText = documents.map((doc, i) => 
        `${i}: ${doc.pageContent.substring(0, 200)}...`
      ).join('\n\n');

      const result = await chain.invoke({ documents: documentsText });
      const groups = JSON.parse(result);

      // Reorder documents based on groups
      const reordered: RerankedDocument[] = [];
      groups.forEach((group: number[]) => {
        group.forEach(index => {
          if (documents[index]) {
            reordered.push(documents[index]);
          }
        });
      });

      return reordered;
    } catch (error) {
      console.warn('Semantic grouping failed, using original order:', error);
      return documents;
    }
  }

  private createOverlappingChunks(documents: RerankedDocument[]): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    let chunkId = 0;

    documents.forEach((doc, docIndex) => {
      const content = doc.pageContent;
      const words = content.split(' ');
      
      for (let i = 0; i < words.length; i += this.config.maxChunkSize - this.config.overlapSize) {
        const chunkWords = words.slice(i, i + this.config.maxChunkSize);
        const chunkContent = chunkWords.join(' ');
        
        if (chunkContent.trim().length > 100) { // Minimum chunk size
          chunks.push({
            id: `chunk_${chunkId++}`,
            content: chunkContent,
            sources: [doc.metadata?.url || `doc_${docIndex}`],
            relevanceScore: doc.relevanceScore || 0,
            metadata: {
              ...doc.metadata,
              documentIndex: docIndex,
              chunkIndex: i / (this.config.maxChunkSize - this.config.overlapSize)
            }
          });
        }
      }
    });

    return chunks;
  }

  private createOverlappingChunksOptimized(documents: RerankedDocument[]): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    let chunkId = 0;

    // Pre-compile regex for better performance
    const wordSplitRegex = /\s+/;
    const minChunkLength = 100;
    const chunkStep = Math.max(1, this.config.maxChunkSize - this.config.overlapSize);

    documents.forEach((doc, docIndex) => {
      const content = doc.pageContent;
      if (!content || content.length < minChunkLength) return;

      // Use more efficient splitting for large documents
      const words = content.split(wordSplitRegex);
      const totalWords = words.length;
      
      // Skip if document is too small
      if (totalWords < 50) return;
      
      // Create chunks with optimized loop
      for (let i = 0; i < totalWords; i += chunkStep) {
        const endIndex = Math.min(i + this.config.maxChunkSize, totalWords);
        const chunkWords = words.slice(i, endIndex);
        const chunkContent = chunkWords.join(' ');
        
        if (chunkContent.length >= minChunkLength) {
          chunks.push({
            id: `chunk_${chunkId++}`,
            content: chunkContent,
            sources: [doc.metadata?.url || `doc_${docIndex}`],
            relevanceScore: doc.relevanceScore || 0,
            metadata: {
              ...doc.metadata,
              documentIndex: docIndex,
              chunkIndex: Math.floor(i / chunkStep),
              wordCount: chunkWords.length,
              charCount: chunkContent.length
            }
          });
        }

        // Early break if we have enough chunks
        if (chunks.length >= this.config.maxChunks * 2) break;
      }
    });

    console.log(`📊 ContextualFusion: Created ${chunks.length} optimized chunks from ${documents.length} documents`);
    return chunks;
  }

  private deduplicateChunks(chunks: ContextChunk[]): ContextChunk[] {
    const seen = new Set<string>();
    const unique: ContextChunk[] = [];

    chunks.forEach(chunk => {
      const normalized = chunk.content.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(chunk);
      }
    });

    return unique;
  }

  private async enhanceChunksWithContext(
    query: string,
    chunks: ContextChunk[],
    llm: BaseChatModel
  ): Promise<ContextChunk[]> {
    // Add safety checks
    if (!llm) {
      console.warn('LLM not provided to enhanceChunksWithContext, returning chunks as-is');
      return chunks;
    }
    
    if (!chunks || chunks.length === 0) {
      console.warn('No chunks provided to enhanceChunksWithContext');
      return [];
    }
    const prompt = ChatPromptTemplate.fromTemplate(`
      Enhance the following context chunk to better answer the query.
      Add relevant context, clarify ambiguous information, and ensure coherence.
      Keep the enhanced content concise and focused.
      
      Query: {query}
      Original Chunk: {chunk}
      
      Return only the enhanced content, no other text.
    `);

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser()
    ]);

    const enhancedChunks = await Promise.all(
      chunks.map(async (chunk, index) => {
        try {
          // Add safety check for chunk content
          if (!chunk || !chunk.content) {
            console.warn(`Chunk ${index} has no content, skipping enhancement`);
            return chunk;
          }

          const enhancedContent = await chain.invoke({
            query,
            chunk: chunk.content
          });

          return {
            ...chunk,
            content: enhancedContent.trim()
          };
        } catch (error) {
          console.warn(`Failed to enhance chunk ${chunk?.id || index}:`, error);
          return chunk;
        }
      })
    );

    return enhancedChunks;
  }

  private async enhanceChunksWithContextBatched(
    query: string,
    chunks: ContextChunk[],
    llm: BaseChatModel,
    progressCallback?: (progress: number, stage: string) => void
  ): Promise<ContextChunk[]> {
    // Add safety checks
    if (!llm) {
      console.warn('LLM not provided to enhanceChunksWithContextBatched, returning chunks as-is');
      return chunks;
    }
    
    if (!chunks || chunks.length === 0) {
      console.warn('No chunks provided to enhanceChunksWithContextBatched');
      return [];
    }

    // Create batched prompt for multiple chunks
    const batchedPrompt = ChatPromptTemplate.fromTemplate(`
      Enhance the following context chunks to better answer the query.
      For each chunk, add relevant context, clarify ambiguous information, and ensure coherence.
      Keep each enhanced chunk concise and focused.
      Return the enhanced chunks in the same order, separated by "---CHUNK_SEPARATOR---"
      
      Query: {query}
      
      Chunks to enhance:
      {chunks}
      
      Return only the enhanced content for each chunk, separated by ---CHUNK_SEPARATOR---, no other text.
    `);

    const chain = RunnableSequence.from([
      batchedPrompt,
      llm,
      new StringOutputParser()
    ]);

    // Helper function to create batches
    const createBatches = <T>(array: T[], size: number): T[][] => {
      const batches: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        batches.push(array.slice(i, i + size));
      }
      return batches;
    };

    const batchSize = this.config.batchSize || 3;
    const batches = createBatches(chunks, batchSize);
    const enhancedChunks: ContextChunk[] = [];
    
    console.log(`🚀 ContextualFusion: Processing ${chunks.length} chunks in ${batches.length} batches (batch size: ${batchSize})`);

    // Process batches sequentially or in parallel based on config
    if (this.config.enableParallelProcessing && batches.length > 1) {
      // Parallel processing with controlled concurrency
      const maxConcurrency = 2; // Limit to prevent overwhelming the LLM
      const concurrentBatches = createBatches(batches, maxConcurrency);
      
      for (let i = 0; i < concurrentBatches.length; i++) {
        const currentBatches = concurrentBatches[i];
        const batchPromises = currentBatches.map(async (batch, batchIndex) => {
          return this.processSingleBatch(query, batch, chain, i * maxConcurrency + batchIndex);
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => enhancedChunks.push(...result));
        
        // Update progress
        const progress = 80 + (20 * (i + 1) / concurrentBatches.length);
        if (progressCallback) {
          progressCallback(progress, `Enhanced ${enhancedChunks.length}/${chunks.length} chunks`);
        }
      }
    } else {
      // Sequential processing
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchResult = await this.processSingleBatch(query, batch, chain, i);
        enhancedChunks.push(...batchResult);
        
        // Update progress
        const progress = 80 + (20 * (i + 1) / batches.length);
        if (progressCallback) {
          progressCallback(progress, `Enhanced batch ${i + 1}/${batches.length} (${enhancedChunks.length}/${chunks.length} chunks)`);
        }
      }
    }

    console.log(`✅ ContextualFusion: Successfully enhanced ${enhancedChunks.length}/${chunks.length} chunks`);
    return enhancedChunks;
  }

  private async processSingleBatch(
    query: string,
    batch: ContextChunk[],
    chain: RunnableSequence<any, string>,
    batchIndex: number
  ): Promise<ContextChunk[]> {
    try {
      const batchStartTime = Date.now();
      
      // Prepare chunks text for batch processing
      const chunksText = batch.map((chunk, i) => 
        `Chunk ${i + 1}:\n${chunk.content}\n`
      ).join('\n');

      const enhancedContent = await chain.invoke({
        query,
        chunks: chunksText
      });

      // Split the enhanced content back into individual chunks
      const enhancedChunkContents = enhancedContent
        .split('---CHUNK_SEPARATOR---')
        .map(content => content.trim())
        .filter(content => content.length > 0);

      // Map back to original chunk structure
      const enhancedBatch = batch.map((originalChunk, index) => {
        const enhancedText = enhancedChunkContents[index] || originalChunk.content;
        return {
          ...originalChunk,
          content: enhancedText,
          metadata: {
            ...originalChunk.metadata,
            enhanced: true,
            batchIndex,
            enhancementTime: Date.now() - batchStartTime
          }
        };
      });

      console.log(`📊 ContextualFusion: Batch ${batchIndex + 1} enhanced ${batch.length} chunks in ${Date.now() - batchStartTime}ms`);
      return enhancedBatch;

    } catch (error) {
      console.warn(`Failed to enhance batch ${batchIndex}:`, error);
      // Return original chunks on failure
      return batch.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          enhanced: false,
          enhancementError: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  }

  async mergeChunksIntoUnifiedContext(
    query: string,
    chunks: ContextChunk[],
    llm: BaseChatModel
  ): Promise<string> {
    // Add safety checks
    if (!chunks || chunks.length === 0) return '';
    
    if (!llm) {
      console.warn('LLM not provided to mergeChunksIntoUnifiedContext, returning concatenated chunks');
      return chunks.map(chunk => chunk.content).join('\n\n');
    }

    const prompt = ChatPromptTemplate.fromTemplate(`
      Merge the following context chunks into a unified, coherent context that answers the query.
      Eliminate redundancy, resolve contradictions, and create a smooth narrative flow.
      Maintain all important information while ensuring logical coherence.
      
      Query: {query}
      
      Context Chunks:
      {chunks}
      
      Return only the unified context, no other text.
    `);

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser()
    ]);

    try {
      // Add safety check for chunks content
      const validChunks = chunks.filter(chunk => chunk && chunk.content && chunk.content.trim().length > 0);
      
      if (validChunks.length === 0) {
        console.warn('No valid chunks to merge');
        return '';
      }

      const chunksText = validChunks.map((chunk, i) => 
        `Chunk ${i + 1}:\n${chunk.content}\n`
      ).join('\n');

      const unifiedContext = await chain.invoke({
        query,
        chunks: chunksText
      });

      return unifiedContext.trim();
    } catch (error) {
      console.error('Failed to merge chunks:', error);
      // Fallback: concatenate chunks with separators
      const validChunks = chunks.filter(chunk => chunk && chunk.content);
      return validChunks.map(chunk => chunk.content).join('\n\n---\n\n');
    }
  }

  updateConfig(newConfig: Partial<FusionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

