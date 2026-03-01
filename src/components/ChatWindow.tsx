'use client';

import { useEffect, useRef, useState } from 'react';
import { Document } from '@langchain/core/documents';
import { PipelineStage } from '@/lib/search/orchestrator';
import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import crypto from 'crypto';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSuggestions } from '@/lib/actions';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import NextError from 'next/error';

const getPreferredLocalQuickModel = () => {
  const forcedModel = process.env.NEXT_PUBLIC_WEBLLM_MODEL;
  if (forcedModel && forcedModel.trim().length > 0) return forcedModel;

  const memoryGB = Number((navigator as any).deviceMemory || 0);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (isMobile && memoryGB > 0 && memoryGB <= 4) {
    return 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
  }

  return 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
};

let localEnginePromise: Promise<any> | null = null;

const isWebGpuSupported = () =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  'gpu' in navigator;

const getLocalEngine = async (
  onProgress?: (progressText: string) => void,
): Promise<any> => {
  if (!isWebGpuSupported()) {
    throw new Error('WebGPU is not available on this device/browser');
  }

  if (!localEnginePromise) {
    localEnginePromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');
      return webllm.CreateMLCEngine(getPreferredLocalQuickModel(), {
        initProgressCallback: (progress: any) => {
          const text =
            progress?.text || progress?.status || 'Loading local model...';
          if (onProgress) onProgress(String(text));
        },
      });
    })().catch((error) => {
      localEnginePromise = null;
      throw error;
    });
  }

  return localEnginePromise;
};

const runLocalQuickSearch = async (
  query: string,
  onProgress?: (progressText: string) => void,
) => {
  const searchRes = await fetch(
    `/api/searxng?q=${encodeURIComponent(query)}&format=json`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!searchRes.ok) {
    throw new Error(`SearXNG request failed with status ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const rawResults = Array.isArray(searchData?.results) ? searchData.results : [];
  const topResults = rawResults.slice(0, 8);

  if (topResults.length === 0) {
    return {
      answer:
        "I couldn't find web results for that query right now. Try rephrasing or checking your SearXNG endpoint.",
      sources: [],
    };
  }

  const contextText = topResults
    .map((result: any, index: number) => {
      const title = result?.title || 'Untitled';
      const url = result?.url || '';
      const content = result?.content || '';
      return `[${index + 1}] ${title}\nURL: ${url}\nSnippet: ${content}`;
    })
    .join('\n\n');

  const localPrompt = `You are a concise web research assistant. Use only the provided search snippets, cite source numbers like [1], and say when information is uncertain.

Question: ${query}

Search snippets:
${contextText}

Write a direct answer with citations.`;

  let answer = '';

  const electronLlm = (window as any)?.electronLLM;
  if (electronLlm?.chat) {
    if (electronLlm?.prepare) {
      const prep = await electronLlm.prepare();
      if (!prep?.ok) {
        throw new Error(prep?.reason || 'Failed to prepare local desktop model');
      }
    }

    const desktopResult = await electronLlm.chat({
      prompt: localPrompt,
      maxTokens: 512,
      temperature: 0.2,
    });
    answer = desktopResult?.text || '';
  } else {
    const engine = await getLocalEngine(onProgress);
    const completion = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a concise web research assistant. Use only the provided search snippets, cite source numbers like [1], and say when information is uncertain.',
        },
        {
          role: 'user',
          content: `Question: ${query}\n\nSearch snippets:\n${contextText}\n\nWrite a direct answer with citations.`,
        },
      ],
      temperature: 0.2,
    });

    answer =
      completion?.choices?.[0]?.message?.content?.toString() || '';
  }

  if (!answer) {
    answer = 'I could not generate a local response for that query.';
  }

  const sources = topResults.map((result: any) => ({
    pageContent: result?.content || '',
    metadata: {
      title: result?.title || 'Untitled',
      url: result?.url || '',
      source: result?.engine || 'searxng',
    },
  }));

  return { answer, sources };
};


export type ImageResult = {
  img_src: string;
  url: string;
  title: string;
};

export type VideoResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
};

export type SearchIntent = {
  needsImages: boolean;
  needsVideos: boolean;
  confidence: {
    images: number;
    videos: number;
  };
  reasoning: string;
  primaryIntent: 'documents' | 'images' | 'videos' | 'mixed';
};

export type Message = {
  messageId: string;
  chatId: string;
  createdAt: Date;
  content: string;
  role: 'user' | 'assistant';
  suggestions?: string[];
  sources?: Document[];
  
  // Unified search results
  images?: ImageResult[];
  videos?: VideoResult[];
  searchIntent?: SearchIntent;
  
  currentStep?: string;
  steps?: string[];
  
  // Q-S-R-E-D Pipeline stages  
  pipelineStages?: PipelineStage[];
  
  // Orchestrator data
  orchestratorSteps?: any[];
  orchestratorPlan?: any;
  isOrchestrator?: boolean;
  // Follow-up questions and related queries
  followUpQuestions?: string[];
  relatedQueries?: string[];
  
  // Pro and Ultra search specific data
  proQueries?: string[];
  ultraQueries?: string[];
  ultraAgents?: any[];
  
  // Search agents data
  agents?: Array<{
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    query: string;
    results: number;
  }>;
  
  // Real-time progress tracking
  progress?: {
    step: string;
    message: string;
    details: string;
    progress: number;
  };
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  name: string;
  provider: string;
}

interface EmbeddingModelProvider {
  name: string;
  provider: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModel = localStorage.getItem('chatModel');
    let chatModelProvider = localStorage.getItem('chatModelProvider');
    let embeddingModel = localStorage.getItem('embeddingModel');
    let embeddingModelProvider = localStorage.getItem('embeddingModelProvider');

    const autoImageSearch = localStorage.getItem('autoImageSearch');
    const autoVideoSearch = localStorage.getItem('autoVideoSearch');

    if (!autoImageSearch) {
      localStorage.setItem('autoImageSearch', 'true');
    }

    if (!autoVideoSearch) {
      localStorage.setItem('autoVideoSearch', 'false');
    }

    const providers = await fetch(`/api/models`, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(async (res) => {
      if (!res.ok)
        throw new Error(
          `Failed to fetch models: ${res.status} ${res.statusText}`,
        );
      return res.json();
    });

    if (
      !chatModel ||
      !chatModelProvider ||
      !embeddingModel ||
      !embeddingModelProvider
    ) {
      if (!chatModel || !chatModelProvider) {
        const chatModelProviders = providers.chatModelProviders;

        chatModelProvider =
          chatModelProvider || Object.keys(chatModelProviders)[0];

        chatModel = Object.keys(chatModelProviders[chatModelProvider])[0];

        if (!chatModelProviders || Object.keys(chatModelProviders).length === 0)
          return toast.error('No chat models available');
      }

      if (!embeddingModel || !embeddingModelProvider) {
        const embeddingModelProviders = providers.embeddingModelProviders;

        if (
          !embeddingModelProviders ||
          Object.keys(embeddingModelProviders).length === 0
        )
          return toast.error('No embedding models available');

        embeddingModelProvider = Object.keys(embeddingModelProviders)[0];
        embeddingModel = Object.keys(
          embeddingModelProviders[embeddingModelProvider],
        )[0];
      }

      localStorage.setItem('chatModel', chatModel!);
      localStorage.setItem('chatModelProvider', chatModelProvider);
      localStorage.setItem('embeddingModel', embeddingModel!);
      localStorage.setItem('embeddingModelProvider', embeddingModelProvider);
    } else {
      const chatModelProviders = providers.chatModelProviders;
      const embeddingModelProviders = providers.embeddingModelProviders;

      if (
        Object.keys(chatModelProviders).length > 0 &&
        !chatModelProviders[chatModelProvider]
      ) {
        const chatModelProvidersKeys = Object.keys(chatModelProviders);
        chatModelProvider =
          chatModelProvidersKeys.find(
            (key) => Object.keys(chatModelProviders[key]).length > 0,
          ) || chatModelProvidersKeys[0];

        localStorage.setItem('chatModelProvider', chatModelProvider);
      }

      if (
        chatModelProvider &&
        !chatModelProviders[chatModelProvider][chatModel]
      ) {
        chatModel = Object.keys(
          chatModelProviders[
            Object.keys(chatModelProviders[chatModelProvider]).length > 0
              ? chatModelProvider
              : Object.keys(chatModelProviders)[0]
          ],
        )[0];
        localStorage.setItem('chatModel', chatModel);
      }

      if (
        Object.keys(embeddingModelProviders).length > 0 &&
        !embeddingModelProviders[embeddingModelProvider]
      ) {
        embeddingModelProvider = Object.keys(embeddingModelProviders)[0];
        localStorage.setItem('embeddingModelProvider', embeddingModelProvider);
      }

      if (
        embeddingModelProvider &&
        !embeddingModelProviders[embeddingModelProvider][embeddingModel]
      ) {
        embeddingModel = Object.keys(
          embeddingModelProviders[embeddingModelProvider],
        )[0];
        localStorage.setItem('embeddingModel', embeddingModel);
      }
    }

    setChatModelProvider({
      name: chatModel!,
      provider: chatModelProvider,
    });

    setEmbeddingModelProvider({
      name: embeddingModel!,
      provider: embeddingModelProvider,
    });

    setIsConfigReady(true);
  } catch (err) {
    console.error('An error occurred while checking the configuration:', err);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  setChatHistory: (history: [string, string][]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = data.messages.map((msg: any) => {
    return {
      ...msg,
      ...JSON.parse(msg.metadata),
    };
  }) as Message[];

  // Ensure messages are properly sorted by createdAt
  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Debug logging to check message order
  console.log('Loaded messages order:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 50), createdAt: m.createdAt })));

  setMessages(messages);

  const history = messages.map((msg) => {
    return [msg.role, msg.content];
  }) as [string, string][];

  console.debug(new Date(), 'app:messages_loaded');

  document.title = messages[0].content;

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  setChatHistory(history);
  
  setIsMessagesLoaded(true);
};

const ChatWindow = ({ id }: { id?: string }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(id);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      name: '',
      provider: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      name: '',
      provider: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);


  const [searchMode, setSearchMode] = useState('quickSearch');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        setChatHistory,
        setNotFound,
        setFiles,
        setFileIds,
      );
    } else if (!chatId) {
      const newChatId = crypto.randomBytes(20).toString('hex');
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(newChatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady]);

  const sendMessage = async (message: string, messageId?: string) => {
    if (loading) return;
    if (!isConfigReady) {
      toast.error('Cannot send message before the configuration is ready');
      return;
    }

    // Update URL with chat ID if this is the first message in an empty chat
    if (messages.length === 0 && chatId) {
      // Update URL without triggering router change to avoid refresh
      window.history.pushState({}, '', `/c/${chatId}`);
    }

    setLoading(true);
    setMessageAppeared(false);

    let sources: Document[] | undefined = undefined;
    let recievedMessage = '';
    let added = false;
    let currentStep = 'search';
    let completedSteps: string[] = [];

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        content: message,
        messageId: messageId,
        chatId: chatId!,
        role: 'user',
        createdAt: new Date(),
      },
    ]);

    if (searchMode === 'quickSearch') {
      try {
        toast.message(`Running local quick search (${getPreferredLocalQuickModel()})...`);
        const local = await runLocalQuickSearch(message);

        const assistantMessageId = crypto.randomBytes(7).toString('hex');
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            content: local.answer,
            messageId: assistantMessageId,
            chatId: chatId!,
            role: 'assistant',
            sources: local.sources as any,
            currentStep: 'complete',
            steps: ['search', 'refine', 'read', 'generate', 'complete'],
            createdAt: new Date(),
          },
        ]);

        setChatHistory((prevHistory) => [
          ...prevHistory,
          ['human', message],
          ['assistant', local.answer],
        ]);
        setMessageAppeared(true);
        setLoading(false);
        return;
      } catch (localError) {
        console.warn('Local quick search failed; falling back to server route.', localError);
        toast.error(
          'Local quick search failed on this device. Falling back to server search.',
        );
      }
    }

    const messageHandler = async (data: any) => {
      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        return;
      }

      // Handle orchestrator data
      if (data.type === 'plan') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              return {
                ...msg,
                orchestratorPlan: data.data,
                isOrchestrator: true,
              };
            }
            return msg;
          })
        );
        return;
      }

      if (data.type === 'stepUpdate') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              const existingSteps = msg.orchestratorSteps || [];
              const updatedSteps = existingSteps.map((step: any) => 
                step.id === data.step.id ? data.step : step
              );
              
              // Add new step if it doesn't exist
              if (!existingSteps.find((step: any) => step.id === data.step.id)) {
                updatedSteps.push(data.step);
              }
              
              return {
                ...msg,
                orchestratorSteps: updatedSteps,
                isOrchestrator: true,
              };
            }
            return msg;
          })
        );
        return;
      }

      if (data.type === 'step') {
        currentStep = data.step;
        if (data.completed) {
          completedSteps.push(data.step);
        }
        
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                currentStep: currentStep,
                steps: completedSteps,
              };
            }
            return msg;
          })
        );
        return;
      }

              if (data.type === 'followUps') {
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.messageId === messageId) {
                return {
                  ...msg,
                  followUpQuestions: data.data.followUpQuestions,
                  relatedQueries: data.data.relatedQueries,
                };
              }
              return msg;
            })
          );
          return;
        }

        if (data.type === 'progress') {
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.messageId === messageId) {
                return {
                  ...msg,
                  progress: data.data,
                };
              }
              return msg;
            })
          );
          return;
        }

      // Handle ultra search queries display
      if (data.type === 'ultraQueries') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              return {
                ...msg,
                ultraQueries: data.data,
              };
            }
            return msg;
          })
        );
        return;
      }

      // Handle ultra search agents display
      if (data.type === 'ultraAgents') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              return {
                ...msg,
                ultraAgents: data.data,
              };
            }
            return msg;
          })
        );
        return;
      }

      // Handle pro search queries display
      if (data.type === 'proQueries') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              return {
                ...msg,
                proQueries: data.data,
              };
            }
            return msg;
          })
        );
        return;
      }

      // Handle agents data
      if (data.type === 'agents') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              return {
                ...msg,
                agents: data.data,
                isOrchestrator: true,
              };
            }
            return msg;
          })
        );
        return;
      }

      // Handle agent updates
      if (data.type === 'agentUpdate') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === messageId) {
              const existingAgents = msg.agents || [];
              const updatedAgents = existingAgents.map((agent) => 
                agent.id === data.data.id ? { ...agent, ...data.data } : agent
              );
              
              // Add new agent if it doesn't exist
              if (!existingAgents.find((agent) => agent.id === data.data.id)) {
                updatedAgents.push(data.data);
              }
              
              return {
                ...msg,
                agents: updatedAgents,
                isOrchestrator: true,
              };
            }
            return msg;
          })
        );
        return;
      }

      if (data.type === 'sources') {
        sources = data.data;
        completedSteps.push('search');
        completedSteps.push('refine');
        completedSteps.push('read');
        
        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: '',
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              sources: sources,
              currentStep: 'generate',
              steps: completedSteps,
              createdAt: new Date(),
            },
          ]);
          added = true;
        } else {
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.messageId === data.messageId) {
                return {
                  ...msg,
                  sources: sources,
                  currentStep: 'generate',
                  steps: completedSteps,
                };
              }
              return msg;
            })
          );
        }
        setMessageAppeared(true);
      }

      // Handle unified search results - images
      if (data.type === 'images') {
        console.log('🖼️ ChatWindow: Received images data:', data.data?.length || 0, 'images');
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              console.log('🖼️ ChatWindow: Updating message with images:', data.data?.length || 0);
              return {
                ...msg,
                images: data.data,
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle unified search results - videos
      if (data.type === 'videos') {
        console.log('🎥 ChatWindow: Received videos data:', data.data?.length || 0, 'videos');
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              console.log('🎥 ChatWindow: Updating message with videos:', data.data?.length || 0);
              return {
                ...msg,
                videos: data.data,
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle search intent detection
      if (data.type === 'intent_detected') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                searchIntent: data.data.intent,
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle stage completion events
      if (data.type === 'stage_complete') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              const updatedStages = msg.pipelineStages?.map(stage => 
                stage.stage === data.data.stage 
                  ? { ...stage, status: 'completed' as const, progress: 100 } 
                  : stage
              ) || [];
              
              return {
                ...msg,
                pipelineStages: updatedStages,
                isOrchestrator: true,
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle pipeline progress updates
      if (data.type === 'pipeline_progress') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              const updatedStages = msg.pipelineStages?.map(stage => 
                stage.stage === data.data.stage 
                  ? { ...stage, status: 'running' as const, progress: data.data.progress || 0 } 
                  : stage
              ) || [];
              
              return {
                ...msg,
                pipelineStages: updatedStages,
                isOrchestrator: true,
                progress: {
                  step: data.data.stage,
                  message: `${data.data.stage} Pipeline: ${data.data.progress || 0}%`,
                  details: `Processing stage ${data.data.stage}`,
                  progress: data.data.progress || 0,
                },
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle search completion
      if (data.type === 'search_complete') {
        completedSteps.push('complete');
        
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                currentStep: 'complete',
                steps: [...(msg.steps || []), 'complete'],
                progress: {
                  step: 'complete',
                  message: 'Search completed',
                  details: `Execution time: ${data.data?.executionTime || 0}ms`,
                  progress: 100,
                },
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      // Handle Q-S-R-E-D Pipeline events
      if (data.type === 'pipeline_status') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                pipelineStages: data.data.stages,
                isOrchestrator: true,
                progress: {
                  step: data.data.currentStage || 'pipeline',
                  message: `Pipeline Progress: ${data.data.overallProgress || 0}%`,
                  details: `${data.data.activeStages || 0} active stages`,
                  progress: data.data.overallProgress || 0,
                },
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      if (data.type === 'stage_update') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              const updatedStages = msg.pipelineStages?.map(stage => 
                stage.stage === data.data.stage 
                  ? { ...stage, ...data.data } 
                  : stage
              ) || [];
              
              return {
                ...msg,
                pipelineStages: updatedStages,
                isOrchestrator: true,
                progress: {
                  step: data.data.stage,
                  message: data.data.status === 'running' 
                    ? `${data.data.name}: ${data.data.description}`
                    : data.data.status === 'completed'
                    ? `${data.data.name}: Completed`
                    : `${data.data.name}: ${data.data.status}`,
                  details: data.data.error || '',
                  progress: data.data.progress || 0,
                },
              };
            }
            return msg;
          })
        );
        setMessageAppeared(true);
      }

      if (data.type === 'qsred_pipeline_init') {
        // Initialize message with empty pipeline stages for Q-S-R-E-D
        const initialStages = [
          {
            stage: 'Q' as const,
            name: 'Query Understanding',
            description: 'Analyzing query intent and context',
            status: 'pending' as const,
            progress: 0,
          },
          {
            stage: 'S' as const,
            name: 'Search Execution',
            description: 'Retrieving relevant documents',
            status: 'pending' as const,
            progress: 0,
          },
          {
            stage: 'R' as const,
            name: 'Ranking & Relevance',
            description: 'Neural reranking and relevance scoring',
            status: 'pending' as const,
            progress: 0,
          },
          {
            stage: 'E' as const,
            name: 'Content Extraction',
            description: 'Extracting and processing key information',
            status: 'pending' as const,
            progress: 0,
          },
          {
            stage: 'D' as const,
            name: 'Response Delivery',
            description: 'Generating and streaming final response',
            status: 'pending' as const,
            progress: 0,
          },
        ];

        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: '',
              messageId: data.messageId || `msg_${Date.now()}`,
              chatId: chatId!,
              role: 'assistant',
              pipelineStages: initialStages,
              isOrchestrator: true,
              sources: [],
              progress: {
                step: 'pipeline_init',
                message: 'Q-S-R-E-D Pipeline initialized',
                details: data.data?.mode || 'quick',
                progress: 0,
              },
              createdAt: new Date(),
            },
          ]);
          added = true;
        }
        setMessageAppeared(true);
      }

      if (data.type === 'qsred_pipeline_done') {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                progress: {
                  step: 'complete',
                  message: 'Q-S-R-E-D Pipeline completed',
                  details: `Mode: ${data.data?.mode || 'quick'}`,
                  progress: 100,
                },
              };
            }
            return msg;
          })
        );
      }

      if (data.type === 'response_chunk') {
        const chunk = data.data?.toString() || '';
        if (!chunk) return;

        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: chunk,
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              sources: sources,
              currentStep: 'generate',
              steps: completedSteps,
              createdAt: new Date(),
            },
          ]);
          added = true;
          recievedMessage = chunk;
        } else {
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.messageId === data.messageId) {
                return {
                  ...msg,
                  content: msg.content + chunk,
                  sources: sources || msg.sources,
                };
              }
              return msg;
            }),
          );
          recievedMessage += chunk;
        }

        setMessageAppeared(true);
      }

      if (data.type === 'message') {
        console.log('📝 ChatWindow: Received message data, length:', data.data?.length || 0, 'isComplete:', data.isComplete, 'messageId:', data.messageId);
        
        if (!added) {
          console.log('📝 ChatWindow: Creating new assistant message');
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: data.data,
              messageId: data.messageId,
              chatId: chatId!,
              role: 'assistant',
              sources: sources,
              currentStep: 'generate',
              steps: completedSteps,
              createdAt: new Date(),
            },
          ]);
          added = true;
          recievedMessage = data.data;
        } else {
          // Update the existing message with the final content
          console.log('📝 ChatWindow: Updating existing message, preserving images/videos/sources');
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              if (msg.messageId === data.messageId) {
                console.log('📝 ChatWindow: Current message state - images:', msg.images?.length || 0, 'videos:', msg.videos?.length || 0, 'sources:', msg.sources?.length || 0);
                // If this is a complete response or if content is being replaced entirely
                const finalContent = data.isComplete ? data.data : (msg.content + data.data);
                return { 
                  ...msg, 
                  content: finalContent,
                  // Ensure all collected data is preserved
                  sources: sources || msg.sources,
                  images: msg.images,
                  videos: msg.videos,
                  searchIntent: msg.searchIntent,
                  pipelineStages: msg.pipelineStages,
                  isOrchestrator: msg.isOrchestrator,
                };
              }
              return msg;
            })
          );
          recievedMessage = data.isComplete ? data.data : recievedMessage + data.data;
        }
        setMessageAppeared(true);
      }

      if (data.type === 'messageEnd') {
        console.log('ChatWindow: Message ended, messageId:', data.messageId);

        let finalAssistantMessage = recievedMessage;

        if (!finalAssistantMessage || finalAssistantMessage.trim().length === 0) {
          try {
            console.warn('No assistant text in stream; attempting non-stream fallback answer.');
            const fallbackRes = await fetch('/api/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: message,
                sessionId: chatId,
                history: chatHistory,
                stream: false,
                searchMode,
                chatModel: payload.chatModel,
                embeddingModel: payload.embeddingModel,
                systemInstructions: payload.systemInstructions,
                introduceYourself: payload.introduceYourself,
                userLocation: payload.userLocation,
              }),
            });

            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              finalAssistantMessage = fallbackData.message || '';
              sources = fallbackData.sources || sources;
            }
          } catch (fallbackErr) {
            console.error('Failed non-stream fallback after empty stream:', fallbackErr);
          }
        }

        setChatHistory((prevHistory) => [
          ...prevHistory,
          ['human', message],
          ['assistant', finalAssistantMessage],
        ]);

        setLoading(false);

        const currentMessages = messagesRef.current;
        const lastMsg = currentMessages[currentMessages.length - 1];

        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.messageId === data.messageId || msg.messageId === lastMsg?.messageId) {
              return {
                ...msg,
                currentStep: 'complete',
                steps: ['search', 'refine', 'read', 'generate', 'complete'],
                sources: sources || msg.sources,
                content: finalAssistantMessage || msg.content,
              };
            }
            return msg;
          })
        );
        // Generate suggestions for assistant messages with sources
        if (
          lastMsg?.role === 'assistant' &&
          ((lastMsg.sources && lastMsg.sources.length > 0) || (sources && sources.length > 0)) &&
          !lastMsg.suggestions
        ) {
          console.log('🤔 ChatWindow: Generating suggestions for message with sources');
          // Use setTimeout to ensure the message state is updated first
          setTimeout(async () => {
            try {
              const suggestions = await getSuggestions(messagesRef.current);
              console.log('🤔 ChatWindow: Generated', suggestions?.length || 0, 'suggestions');
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.messageId === data.messageId || msg.messageId === lastMsg?.messageId) {
                    return { ...msg, suggestions: suggestions };
                  }
                  return msg;
                }),
              );
            } catch (error) {
              console.error('Failed to get suggestions:', error);
            }
          }, 100);
        } else {
          console.log('🤔 ChatWindow: Not generating suggestions - role:', lastMsg?.role, 'sources:', (lastMsg?.sources?.length || 0), 'existing suggestions:', !!lastMsg?.suggestions);
        }
      }
    };

    const payload = {
      content: message,
      message: {
        messageId: messageId,
        chatId: chatId!,
        content: message,
      },
      chatId: chatId!,
      files: fileIds,
      searchMode: searchMode,
      history: chatHistory,
      chatModel: {
        name: chatModelProvider.name,
        provider: chatModelProvider.provider,
      },
      embeddingModel: {
        name: embeddingModelProvider.name,
        provider: embeddingModelProvider.provider,
      },
      systemInstructions: localStorage.getItem('systemInstructions'),
      introduceYourself: localStorage.getItem('introduceYourself'),
      userLocation: localStorage.getItem('userLocation'),
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Chat API failed with status ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let partialChunk = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        partialChunk += decoder.decode(value, { stream: true });
        const lines = partialChunk.split('\n');
        partialChunk = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            messageHandler(json);
          } catch {
            console.warn('Skipped malformed stream line');
          }
        }
      }

      if (partialChunk.trim()) {
        try {
          const json = JSON.parse(partialChunk);
          messageHandler(json);
        } catch {
          console.warn('Trailing stream chunk was not valid JSON');
        }
      }
    } catch (error) {
      console.error('Primary /api/chat request failed, trying /api/search fallback:', error);
      const fallbackRes = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          sessionId: chatId,
          history: chatHistory,
          stream: false,
          searchMode,
          chatModel: payload.chatModel,
          embeddingModel: payload.embeddingModel,
          systemInstructions: payload.systemInstructions,
          introduceYourself: payload.introduceYourself,
          userLocation: payload.userLocation,
        }),
      });

      if (!fallbackRes.ok) {
        throw new Error(`Fallback /api/search failed with status ${fallbackRes.status}`);
      }

      const fallbackData = await fallbackRes.json();
      const assistantMessageId = crypto.randomBytes(7).toString('hex');

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          content: fallbackData.message || 'No response received.',
          messageId: assistantMessageId,
          chatId: chatId!,
          role: 'assistant',
          sources: fallbackData.sources || [],
          images: fallbackData.images || [],
          videos: fallbackData.videos || [],
          createdAt: new Date(),
          currentStep: 'complete',
          steps: ['search', 'refine', 'read', 'generate', 'complete'],
        },
      ]);

      setChatHistory((prevHistory) => [
        ...prevHistory,
        ['human', message],
        ['assistant', fallbackData.message || ''],
      ]);
      setMessageAppeared(true);
    } finally {
      setLoading(false);
    }
  };

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    const message = messages[index - 1];

    setMessages((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });
    setChatHistory((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });

    sendMessage(message.content, message.messageId);
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  if (hasError) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <Link href="/settings">
            <Settings className="cursor-pointer lg:hidden" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="dark:text-white/70 text-black/70 text-sm">
            Failed to connect to the server. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return isReady ? (
    notFound ? (
      <NextError statusCode={404} />
    ) : (
      <div>
        {messages.length > 0 ? (
          <>
            <Navbar chatId={chatId!} messages={messages} />
            <Chat
              loading={loading}
              messages={messages}
              sendMessage={sendMessage}
              messageAppeared={messageAppeared}
              rewrite={rewrite}
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
            />

          </>
        ) : (
          <EmptyChat
            sendMessage={sendMessage}

            searchMode={searchMode}
            setSearchMode={setSearchMode}
            fileIds={fileIds}
            setFileIds={setFileIds}
            files={files}
            setFiles={setFiles}
          />
        )}
      </div>
    )
  ) : (
    <div className="flex flex-row items-center justify-center min-h-screen">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  );
};

export default ChatWindow;

