'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState, useMemo } from 'react';
import { Message } from './ChatWindow';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Network,
  List,
  Video,
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import Export from './MessageActions/Export';
import MessageSources from './MessageSources';
import FollowUpQuestions from './FollowUpQuestions';
import MessageImages from './MessageImages';
import MessageVideos from './MessageVideos';
import { useSpeech } from 'react-text-to-speech';
import SearchSteps from './SearchSteps';
import SearchStepper, { SearchProgressStep, SourcesProgressStep, BasicProgressStep} from './SearchStepper';
import SearchProgress from './SearchProgress';


type TabType = 'answer' | 'images' | 'videos' | 'sources' | 'steps';

const StepsComponent = ({ 
  loading, 
  message,
  query,
  progress,
  mode = 'quick'
}: { 
  loading: boolean;
  message: Message;
  query: string;
  progress?: {
    step: string;
    message: string;
    details: string;
    progress: number;
  };
  mode?: 'quick' | 'pro' | 'ultra';
}) => {
  // Convert sources to the format expected by SourcesStep
  const formattedSources = useMemo(() => message.sources?.map(source => ({
    title: source.metadata?.title || 'Untitled',
    url: source.metadata?.url || '',
    icon: `https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata?.url}&sz=16`
  })) || [], [message.sources]);

  // Pipeline stage progression mapping for Q-S-R-E-D pipeline
  const stageProgression = useMemo((): Record<string, string> => ({
    // Query Understanding (Q)
    'Q': 'query',
    'query_understanding': 'query',
    'intent_detection': 'query',
    'query_expansion': 'query',
    
    // Search (S)
    'S': 'search',
    'web_search': 'search',
    'document_retrieval': 'search',
    'multi_search': 'search',
    
    // Ranking (R)
    'R': 'ranking',
    'neural_reranking': 'ranking',
    'relevance_scoring': 'ranking',
    
    // Extraction (E)
    'E': 'extraction',
    'contextual_fusion': 'extraction',
    'content_extraction': 'extraction',
    
    // Delivery (D)
    'D': 'delivery',
    'response_generation': 'delivery',
    'answer_synthesis': 'delivery',
    'final_response': 'delivery'
  }), []);

  // Enhanced phase descriptions for Q-S-R-E-D pipeline
  const phaseDescriptions = useMemo(() => ({
    query: {
      title: 'Query Understanding',
      description: mode === 'ultra' ? 'Advanced intent detection and query expansion' :
                  mode === 'pro' ? 'Comprehensive query analysis' :
                  'Efficient query processing'
    },
    search: {
      title: 'Information Retrieval',
      description: mode === 'ultra' ? 'Multi-agent parallel search execution' :
                  mode === 'pro' ? 'Enhanced multi-source search' :
                  'Targeted web search'
    },
    ranking: {
      title: 'Neural Reranking',
      description: mode === 'ultra' ? 'Advanced relevance scoring with adaptive weights' :
                  mode === 'pro' ? 'Enhanced semantic ranking' :
                  'Relevance-based sorting'
    },
    extraction: {
      title: 'Content Extraction',
      description: mode === 'ultra' ? 'Contextual fusion with batched enhancement' :
                  mode === 'pro' ? 'Smart content chunking' :
                  'Key information extraction'
    },
    delivery: {
      title: 'Response Generation',
      description: mode === 'ultra' ? 'Multi-model orchestrated synthesis' :
                  mode === 'pro' ? 'Comprehensive answer generation' :
                  'Focused response creation'
    }
  }), [mode]);

  // Calculate current phase from pipeline stages or progress
  const currentPhase = useMemo(() => {
    if (message.pipelineStages && message.pipelineStages.length > 0) {
      const runningStage = message.pipelineStages.find(stage => stage.status === 'running');
      const lastCompletedStage = message.pipelineStages.filter(stage => stage.status === 'completed').pop();
      const currentStage = runningStage || lastCompletedStage;
      if (currentStage) {
        return stageProgression[currentStage.stage] || stageProgression[currentStage.name] || 'query';
      }
    }
    if (progress) {
      return stageProgression[progress.step] || 'query';
    }
    return 'query';
  }, [progress, stageProgression, message.pipelineStages]);

  // Calculate visible steps based on current pipeline stage and sources
  const visibleSteps = useMemo(() => {
    if (!loading && !progress) {
      return ['query', 'search', 'ranking', 'extraction', 'delivery'];
    }

    const steps: string[] = [];
    
    // Always show query step
    steps.push('query');
    
    // Add search step if we have started or completed Q stage
    if (message.pipelineStages?.some(stage => stage.stage === 'Q' && stage.status !== 'pending') || 
        ['search', 'ranking', 'extraction', 'delivery'].includes(currentPhase)) {
      steps.push('search');
    }
    
    // Add ranking step if we have sources or we're in ranking phase or beyond
    if (formattedSources.length > 0 || 
        ['ranking', 'extraction', 'delivery'].includes(currentPhase)) {
      steps.push('ranking');
    }
    
    // Add extraction step if we're in extraction phase or beyond
    if (['extraction', 'delivery'].includes(currentPhase)) {
      steps.push('extraction');
    }
    
    // Add delivery step if we're in delivery phase or loading is complete
    if (currentPhase === 'delivery' || !loading) {
      steps.push('delivery');
    }
    
    return steps;
  }, [loading, progress, currentPhase, formattedSources.length, message.pipelineStages]);

  // Calculate completed steps based on pipeline stages
  const completedSteps = useMemo(() => {
    if (!loading) {
      return [...visibleSteps];
    }

    const completed: string[] = [];
    
    // Complete query if Q stage is completed
    if (message.pipelineStages?.some(stage => stage.stage === 'Q' && stage.status === 'completed')) {
      completed.push('query');
    }
    
    // Complete search if S stage is completed
    if (message.pipelineStages?.some(stage => stage.stage === 'S' && stage.status === 'completed') || 
        formattedSources.length > 0) {
      completed.push('search');
    }
    
    // Complete ranking if R stage is completed
    if (message.pipelineStages?.some(stage => stage.stage === 'R' && stage.status === 'completed')) {
      completed.push('ranking');
    }
    
    // Complete extraction if E stage is completed
    if (message.pipelineStages?.some(stage => stage.stage === 'E' && stage.status === 'completed')) {
      completed.push('extraction');
    }
    
    // Complete delivery if D stage is completed or loading is done
    if (message.pipelineStages?.some(stage => stage.stage === 'D' && stage.status === 'completed') || 
        !loading) {
      completed.push('delivery');
    }
    
    return completed;
  }, [loading, formattedSources.length, visibleSteps, message.pipelineStages]);

  // Get progress for a specific pipeline stage
  const getStageProgress = (stageName: string) => {
    if (message.pipelineStages) {
      const stage = message.pipelineStages.find(s => s.stage === stageName || s.name.toLowerCase().includes(stageName));
      if (stage) {
        return {
          step: stage.stage,
          message: stage.name,
          details: `Stage ${stage.stage} - ${stage.status}`,
          progress: stage.progress
        };
      }
    }
    
    // Fallback to old progress system
    if (progress) {
      const stageMapping: Record<string, string[]> = {
        'query': ['Q', 'query_understanding', 'intent_detection', 'query_expansion'],
        'search': ['S', 'web_search', 'document_retrieval', 'multi_search'],
        'ranking': ['R', 'neural_reranking', 'relevance_scoring'],
        'extraction': ['E', 'contextual_fusion', 'content_extraction'],
        'delivery': ['D', 'response_generation', 'answer_synthesis']
      };
      
      const relevantSteps = stageMapping[stageName] || [];
      if (relevantSteps.some(step => progress.step.includes(step))) {
        return progress;
      }
    }
    
    return undefined;
  };

  // Determine if step is active (currently running)
  const isStepActive = (stepName: string) => {
    if (!loading) return false;
    const stageProgress = getStageProgress(stepName);
    return stageProgress !== undefined && !completedSteps.includes(stepName);
  };

  // Determine if step is completed
  const isStepCompleted = (stepName: string) => {
    return completedSteps.includes(stepName);
  };

  // Calculate current step number for ProgressStepper
  const currentStepNumber = visibleSteps.length;

  return (
    <div className="w-full">
      <SearchStepper currentStep={currentStepNumber} mode={mode}>
        {visibleSteps.includes('query') && (
          <SearchProgressStep 
            query={query} 
            progress={getStageProgress('query')}
            mode={mode}
          />
        )}
        {visibleSteps.includes('search') && (
          <BasicProgressStep 
            progress={getStageProgress('search')}
            isActive={isStepActive('search')}
            isComplete={isStepCompleted('search')}
            mode={mode}
          >
            Information Retrieval
          </BasicProgressStep>
        )}
        {visibleSteps.includes('ranking') && (
          <SourcesProgressStep 
            sources={formattedSources}
            progress={getStageProgress('ranking')}
            mode={mode}
          />
        )}
        {visibleSteps.includes('extraction') && (
          <BasicProgressStep 
            progress={getStageProgress('extraction')}
            isActive={isStepActive('extraction')}
            isComplete={isStepCompleted('extraction')}
            mode={mode}
          >
            Content Extraction & Fusion
          </BasicProgressStep>
        )}
        {visibleSteps.includes('delivery') && (
          <BasicProgressStep 
            progress={getStageProgress('delivery')}
            isActive={isStepActive('delivery')}
            isComplete={isStepCompleted('delivery')}
            mode={mode}
          >
            {!loading ? 'Response Complete' : 'Generating Response'}
          </BasicProgressStep>
        )}
      </SearchStepper>
    </div>
  );
};

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  dividerRef,
  isLast,
  rewrite,
  sendMessage,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
  rewrite: (messageId: string) => void;
  sendMessage: (message: string) => void;
}) => {
  const [parsedMessage, setParsedMessage] = useState(message.content);
  const [speechMessage, setSpeechMessage] = useState(message.content);
  const [activeTab, setActiveTab] = useState<TabType>(
    loading && isLast ? 'steps' : 'answer'
  );
  const [showSteps, setShowSteps] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set(['answer']));
  const [availableTabs, setAvailableTabs] = useState<Set<TabType>>(new Set(['answer', 'steps']));

  // Determine the search mode based on message properties
  const getSearchMode = (): 'quick' | 'pro' | 'ultra' => {
    if (message.isOrchestrator) {
      // Check for ultra-specific properties
      if (message.progress?.step?.includes('ultra_') || 
          message.progress?.step?.includes('ultra_agents_init') ||
          message.progress?.step?.includes('ultra_batch_search') ||
          message.progress?.step?.includes('ultra_processing') ||
          message.progress?.step?.includes('ultra_generating') ||
          message.progress?.step?.includes('ultra_complete')) {
        return 'ultra';
      }
      // Check for pro-specific properties
      if (message.progress?.step?.includes('pro_') || 
          message.progress?.step?.includes('multi_search') ||
          message.progress?.step?.includes('query_generation') ||
          message.progress?.step?.includes('queries_ready')) {
        return 'pro';
      }
      // Default to quick for orchestrator messages
      return 'quick';
    }
    return 'quick';
  };

  const searchMode = getSearchMode();

  // Convert sources to the format expected by SearchProgress
  const formattedSources = useMemo(() => message.sources?.map(source => ({
    title: source.metadata?.title || 'Untitled',
    url: source.metadata?.url || '',
    icon: `https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata?.url}&sz=16`
  })) || [], [message.sources]);

  // Convert agents data if available
  const agents = useMemo(() => {
    if (message.agents) {
      return message.agents.map((agent, index) => ({
        id: agent.id || `agent-${index + 1}`,
        status: agent.status || 'pending',
        query: agent.query || '',
        results: agent.results || 0
      }));
    }
    return [];
  }, [message.agents]);

  // Track content availability and manage tab visibility based on search intent and actual data
  useEffect(() => {
    const newAvailableTabs = new Set<TabType>();
    
    // Always show steps tab for all assistant messages (not just loading)
    if (message.role === 'assistant' || loading || message.isOrchestrator) {
      newAvailableTabs.add('steps');
    }
    
    // Always show answer tab for assistant messages
    if (message.role === 'assistant') {
      newAvailableTabs.add('answer');
    }
    
    // Show sources tab when sources are available
    if (message.sources && message.sources.length > 0) {
      newAvailableTabs.add('sources');
    }
    
    // Show images/videos tabs only when data is available
    if (message.role === 'assistant') {
      // Show images tab only when images are available
      if (message.images && message.images.length > 0) {
        console.log('🖼️ MessageBox: Adding images tab, found', message.images.length, 'images');
        newAvailableTabs.add('images');
        setLoadedTabs(prev => new Set([...prev, 'images']));
      } else {
        console.log('🖼️ MessageBox: No images available, images data:', message.images);
      }
      
      // Show videos tab only when videos are available
      if (message.videos && message.videos.length > 0) {
        console.log('🎥 MessageBox: Adding videos tab, found', message.videos.length, 'videos');
        newAvailableTabs.add('videos');
        setLoadedTabs(prev => new Set([...prev, 'videos']));
      } else {
        console.log('🎥 MessageBox: No videos available, videos data:', message.videos);
      }
    }
    
    console.log('📊 MessageBox: Available tabs:', Array.from(newAvailableTabs), 'for message:', message.messageId);
    setAvailableTabs(newAvailableTabs);
  }, [message.sources, message.images, message.videos, message.searchIntent, message.role, message.isOrchestrator, loading, isLast]);

  // Smart tab selection based on search intent and loading state
  useEffect(() => {
    if (loading && isLast) {
      setShowSteps(true);
      setActiveTab('steps');
    } else if (!loading && showSteps && message.role === 'assistant') {
      // When loading completes, switch to the most relevant tab based on search intent
      setTimeout(() => {
        setShowSteps(false);
        
        const searchIntent = message.searchIntent;
        const hasImages = message.images && message.images.length > 0;
        const hasVideos = message.videos && message.videos.length > 0;
        const hasSources = message.sources && message.sources.length > 0;
        
        // Smart tab selection based on primary intent and available content
        if (searchIntent?.primaryIntent === 'images' && hasImages) {
          setActiveTab('images');
        } else if (searchIntent?.primaryIntent === 'videos' && hasVideos) {
          setActiveTab('videos');
        } else if (searchIntent?.primaryIntent === 'mixed') {
          // For mixed intent, prefer the content type with higher confidence and availability
          if (hasImages && searchIntent.confidence.images >= searchIntent.confidence.videos) {
            setActiveTab('images');
          } else if (hasVideos) {
            setActiveTab('videos');
          } else {
            setActiveTab('answer');
          }
        } else {
          // Default to answer tab for document-focused or fallback
          setActiveTab('answer');
        }
      }, 1000);
    }
  }, [loading, isLast, showSteps, message.role, message.searchIntent, message.images, message.videos, message.sources]);

  // Show timeline steps for the last user message when loading
  const shouldShowSteps = (loading && isLast && message.role === 'user') || 
                         (message.role === 'assistant' && showSteps);

  useEffect(() => {
    const citationRegex = /\[([^\]]+)\]/g;
    const regex = /\[(\d+)\]/g;
    let processedMessage = message.content;

    if (message.role === 'assistant' && message.content.includes('<think>')) {
      const openThinkTag = processedMessage.match(/<think>/g)?.length || 0;
      const closeThinkTag = processedMessage.match(/<\/think>/g)?.length || 0;

      if (openThinkTag > closeThinkTag) {
        processedMessage += '</think> <a> </a>'; // The extra <a> </a> is to prevent the the think component from looking bad
      }
    }

    if (
      message.role === 'assistant' &&
      message?.sources &&
      message.sources.length > 0
    ) {
      setParsedMessage(
        processedMessage.replace(
          citationRegex,
          (_, capturedContent: string) => {
            const numbers = capturedContent
              .split(',')
              .map((numStr) => numStr.trim());

            const linksHtml = numbers
              .map((numStr) => {
                const number = parseInt(numStr);

                if (isNaN(number) || number <= 0) {
                  return `[${numStr}]`;
                }

                const source = message.sources?.[number - 1];
                const url = source?.metadata?.url;

                if (url) {
                  return `<a href="${url}" target="_blank" className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative">${numStr}</a>`;
                } else {
                  return `[${numStr}]`;
                }
              })
              .join('');

            return linksHtml;
          },
        ),
      );
      setSpeechMessage(message.content.replace(regex, ''));
      return;
    }

    setSpeechMessage(message.content.replace(regex, ''));
    setParsedMessage(processedMessage);
  }, [message.content, message.sources, message.role]);

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const tabs = [
    {
      id: 'answer' as TabType,
      label: 'Answer',
      icon: Sparkles,
      count: null,
    },
    {
      id: 'images' as TabType,
      label: 'Images',
      icon: ImageIcon,
      count: message.images?.length || 0,
    },
    {
      id: 'videos' as TabType,
      label: 'Videos',
      icon: Video,
      count: message.videos?.length || 0,
    },
    {
      id: 'sources' as TabType,
      label: 'Sources',
      icon: Network,
      count: message.sources?.length || 0,
    },
    {
      id: 'steps' as TabType,
      label: 'Steps',
      icon: List,
      count: null,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'answer':
        return (
          <div className="flex flex-col space-y-6">
            {loading && isLast ? (
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className="text-[#24A0ED] animate-spin"
                  size={20}
                />
                <span className="text-black dark:text-white">Generating answer...</span>
              </div>
            ) : (
              <>
                {/* Main Message Content */}
                {parsedMessage && (
                  <Markdown
                  className={cn(
                    'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                    'max-w-none break-words text-black dark:text-white',
                  )}
                >
                  {parsedMessage}
                </Markdown>
                )}

                {/* Follow-up Questions */}
                {!loading && (message.followUpQuestions || message.relatedQueries) && (
                  <FollowUpQuestions
                    followUpQuestions={message.followUpQuestions}
                    relatedQueries={message.relatedQueries}
                    onQuestionSelect={sendMessage}
                    className="mt-6"
                  />
                )}
                

                {/* Important Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Network size={16} className="text-black/70 dark:text-white/70" />
                      <h3 className="text-sm font-medium text-black dark:text-white">Sources</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {message.sources.slice(0, 4).map((source, index) => (
                        <a
                          key={index}
                          href={source.metadata?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start space-x-3 p-3 bg-light-secondary/50 dark:bg-dark-secondary/50 border border-light-secondary dark:border-dark-secondary rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-all duration-200"
                        >
                          <div className="w-8 h-8 rounded-md bg-light-secondary dark:bg-dark-secondary flex items-center justify-center border border-light-secondary dark:border-dark-secondary flex-shrink-0">
                            <img
                              src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${source.metadata?.url}&sz=16`}
                              alt=""
                              className="w-4 h-4 rounded-sm"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="w-4 h-4 bg-gray-600/50 rounded-sm"></div>';
                                }
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-black dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {source.metadata?.title || 'Untitled'}
                            </div>
                            <div className="text-xs text-black/60 dark:text-white/60 truncate mt-1">
                              {source.metadata?.url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </div>
                          </div>
                          <ExternalLink size={14} className="text-black/40 dark:text-white/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                    {message.sources.length > 4 && (
                      <button
                        onClick={() => setActiveTab('sources')}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                      >
                        View all {message.sources.length} sources →
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {loading && isLast ? null : (
              <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4 -mx-2">
                <div className="flex flex-row items-center space-x-1">
                  <Rewrite rewrite={rewrite} messageId={message.messageId} />
                </div>
                <div className="flex flex-row items-center space-x-1">
                  <Export initialMessage={message.content} message={message} />
                  <Copy initialMessage={message.content} message={message} />
                  <button
                    onClick={() => {
                      if (speechStatus === 'started') {
                        stop();
                      } else {
                        start();
                      }
                    }}
                    className="p-2 text-black/70 dark:text-white/70 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                  >
                    {speechStatus === 'started' ? (
                      <StopCircle size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            )}
            {isLast &&
              message.suggestions &&
              message.suggestions.length > 0 &&
              message.role === 'assistant' &&
              !loading && (
                <>
                  <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                  <div className="flex flex-col space-y-3 text-black dark:text-white">
                    <div className="flex flex-row items-center space-x-2 mt-4">
                      <Layers3 />
                      <h3 className="text-xl font-medium">Related</h3>
                    </div>
                    <div className="flex flex-col space-y-3">
                      {message.suggestions.map((suggestion, i) => (
                        <div
                          className="flex flex-col space-y-3 text-sm"
                          key={i}
                        >
                          <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
                          <div
                            onClick={() => {
                              sendMessage(suggestion);
                            }}
                            className="cursor-pointer flex flex-row justify-between font-medium space-x-2 items-center"
                          >
                            <p className="transition duration-200 hover:text-[#24A0ED]">
                              {suggestion}
                            </p>
                            <Plus
                              size={20}
                              className="text-[#24A0ED] flex-shrink-0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
          </div>
        );
      case 'images':
        return (
          <div className="flex flex-col space-y-4">
            {message.images && message.images.length > 0 ? (
              <MessageImages
                key={`images-${message.messageId}`}
                images={message.images}
                query={history[messageIndex - 1]?.content || message.content || ''}
                loading={false}
              />
            ) : loading && message.searchIntent?.needsImages ? (
              <MessageImages
                key={`images-loading-${message.messageId}`}
                images={[]}
                query={history[messageIndex - 1]?.content || message.content || ''}
                loading={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-black/70 dark:text-white/70">No images found for this query</p>
              </div>
            )}
          </div>
        );
      case 'videos':
        return (
          <div className="flex flex-col space-y-4">
            {message.videos && message.videos.length > 0 ? (
              <MessageVideos
                key={`videos-${message.messageId}`}
                videos={message.videos}
                query={history[messageIndex - 1]?.content || message.content || ''}
                loading={false}
              />
            ) : loading && message.searchIntent?.needsVideos ? (
              <MessageVideos
                key={`videos-loading-${message.messageId}`}
                videos={[]}
                query={history[messageIndex - 1]?.content || message.content || ''}
                loading={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-black/70 dark:text-white/70">No videos found for this query</p>
              </div>
            )}
          </div>
        );
      case 'sources':
        return (
          <div className="flex flex-col space-y-4">
            {message.sources && message.sources.length > 0 ? (
              <MessageSources sources={message.sources} />
            ) : (
              <p className="text-black/70 dark:text-white/70">No sources available</p>
            )}
          </div>
        );
      case 'steps':
        return (
          <div className="flex flex-col space-y-4">
            {message.pipelineStages && message.pipelineStages.length > 0 ? (
              <SearchSteps 
                pipelineStages={message.pipelineStages}
                isVisible={true}
                mode={searchMode}
                progress={message.progress}
              />
            ) : loading && isLast ? (
              <SearchProgress
                mode={searchMode}
                pipelineStages={message.pipelineStages}
                progress={message.progress}
                agents={agents}
                sources={formattedSources}
                images={message.images}
                videos={message.videos}
                isVisible={true}
              />
            ) : (
              <StepsComponent 
                loading={loading && isLast}
                message={message}
                query={message.role === 'user' ? message.content : (history[messageIndex - 1]?.content || '')}
                progress={message.progress}
                mode={searchMode}
              />
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      (activeTab === 'images' || activeTab === 'videos') && "-mx-4 md:-mx-8"
    )}>
      {message.role === 'user' && (
        <div
          className={cn(
            'w-full',
            messageIndex === 0 ? 'pt-16' : 'pt-8',
            'break-words',
          )}
        >
          <h2 className="text-black dark:text-white font-medium text-3xl lg:w-9/12">
            {message.content}
          </h2>
        </div>
      )}

      {(message.role === 'assistant' || shouldShowSteps) && (
        <div className={cn(
          "flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9",
          (activeTab === 'images' || activeTab === 'videos') && "lg:flex-col lg:space-x-0"
        )}>
          <div
            ref={dividerRef}
            className={cn(
              "flex flex-col space-y-6 w-full",
              (activeTab === 'images' || activeTab === 'videos') ? "lg:w-full" : "lg:w-9/12"
            )}
          >
            {/* Tabbed Interface */}
            <div className="flex flex-col space-y-4">
              {/* Tab Navigation */}
              <div className="flex flex-row space-x-1 border-b border-light-secondary dark:border-dark-secondary">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  
                  // Only show tabs that are available
                  if (!availableTabs.has(tab.id)) return null;
                  
                  return (
                    <button
                      key={tab.id}
                      data-tab={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setLoadedTabs(prev => new Set([...prev, tab.id]));
                      }}
                      className={cn(
                        'flex flex-row items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors duration-200',
                        activeTab === tab.id
                          ? 'text-black dark:text-white border-b-2 border-[#24A0ED]'
                          : 'text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white'
                      )}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                      {tab.count !== null && tab.count > 0 && (
                        <span className="bg-light-secondary dark:bg-dark-secondary px-2 py-0.5 rounded-full text-xs">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className={cn(
                "min-h-[200px]",
                (activeTab === 'images' || activeTab === 'videos') && "w-full"
              )}>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBox;