/**
 * Real-time Streaming Interface for Search Orchestration
 * Replaces event emitter with streaming capabilities for better performance
 */

export interface SearchStreamData {
  type: 'stage_complete' | 'sources_ready' | 'images_ready' | 'videos_ready' | 
        'response_chunk' | 'response_complete' | 'search_complete' | 'search_error' | 
        'pipeline_progress' | 'stage_progress';
  data: any;
  timestamp: string;
}

export interface StreamingSearchEvents {
  'stage_complete': { 
    stage: 'Q' | 'S' | 'R' | 'E' | 'D';
    name: string;
    data?: any;
    timestamp: string;
  };
  'sources_ready': {
    sources: any[];
    count: number;
    timestamp: string;
  };
  'images_ready': {
    images: any[];
    count: number;
    timestamp: string;
  };
  'videos_ready': {
    videos: any[];
    count: number;
    timestamp: string;
  };
  'response_chunk': {
    chunk: string;
    timestamp: string;
  };
  'response_complete': {
    message: string;
    timestamp: string;
  };
  'search_complete': {
    executionTime: number;
    mode: 'quick' | 'pro' | 'ultra';
    timestamp: string;
  };
  'search_error': {
    error: string;
    stage?: string;
    timestamp: string;
  };
  'pipeline_progress': {
    stage: 'Q' | 'S' | 'R' | 'E' | 'D';
    progress: number;
    timestamp: string;
  };
  'stage_progress': {
    stage: 'Q' | 'S' | 'R' | 'E' | 'D';
    subStage: string;
    progress: number;
    timestamp: string;
  };
}

/**
 * SearchStreamController - Manages real-time streaming for search operations
 */
export class SearchStreamController {
  private controller: ReadableStreamDefaultController<SearchStreamData> | null = null;
  private readableStream: ReadableStream<SearchStreamData>;
  private closed: boolean = false;

  constructor() {
    this.readableStream = new ReadableStream<SearchStreamData>({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.closed = true;
        this.controller = null;
      }
    });
  }

  /**
   * Stream data to connected clients
   */
  streamData<K extends keyof StreamingSearchEvents>(
    type: K,
    data: StreamingSearchEvents[K]
  ): void {
    if (this.closed || !this.controller) {
      return;
    }

    try {
      this.controller.enqueue({
        type,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to stream data:', error);
    }
  }

  /**
   * Stream pipeline progress updates
   */
  streamProgress(stage: 'Q' | 'S' | 'R' | 'E' | 'D', progress: number): void {
    this.streamData('pipeline_progress', {
      stage,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Stream stage-specific progress updates
   */
  streamStageProgress(
    stage: 'Q' | 'S' | 'R' | 'E' | 'D',
    subStage: string,
    progress: number
  ): void {
    this.streamData('stage_progress', {
      stage,
      subStage,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Stream response chunks for real-time response building
   */
  streamResponseChunk(chunk: string): void {
    this.streamData('response_chunk', {
      chunk,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Complete the search and close the stream
   */
  complete(executionTime: number, mode: 'quick' | 'pro' | 'ultra'): void {
    this.streamData('search_complete', {
      executionTime,
      mode,
      timestamp: new Date().toISOString()
    });
    
    if (this.controller && !this.closed) {
      this.controller.close();
      this.closed = true;
    }
  }

  /**
   * Stream error and close the stream
   */
  error(error: string, stage?: string): void {
    this.streamData('search_error', {
      error,
      stage,
      timestamp: new Date().toISOString()
    });
    
    if (this.controller && !this.closed) {
      this.controller.error(new Error(error));
      this.closed = true;
    }
  }

  /**
   * Get the readable stream
   */
  getStream(): ReadableStream<SearchStreamData> {
    return this.readableStream;
  }

  /**
   * Check if stream is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Close the stream manually
   */
  close(): void {
    if (this.controller && !this.closed) {
      this.controller.close();
      this.closed = true;
    }
  }
}

/**
 * StreamingSearchInterface - Interface for search orchestrators with streaming
 */
export interface StreamingSearchInterface {
  /**
   * Execute search with real-time streaming
   */
  executeSearchWithStreaming(
    query: string,
    history: any[],
    llm: any,
    embeddings: any,
    fileIds?: string[],
    systemInstructions?: string
  ): Promise<{ result: any; stream: ReadableStream<SearchStreamData> }>;
}

/**
 * Utility function to convert stream to async iterator for easier consumption
 */
export async function* streamToAsyncIterator(
  stream: ReadableStream<SearchStreamData>
): AsyncGenerator<SearchStreamData, void, unknown> {
  const reader = stream.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Utility function to create a streaming response for HTTP endpoints
 */
export function createStreamingResponse(stream: ReadableStream<SearchStreamData>): Response {
  const encoder = new TextEncoder();
  
  const transformedStream = new ReadableStream({
    start(controller) {
      const reader = stream.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            
            // Format as Server-Sent Events
            const data = `data: ${JSON.stringify(value)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch (error) {
          controller.error(error);
        }
      };
      
      pump();
    }
  });

  return new Response(transformedStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}
