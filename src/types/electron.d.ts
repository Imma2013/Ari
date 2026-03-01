export {};

declare global {
  interface Window {
    electronLLM?: {
      availability: () => Promise<{
        available: boolean;
        reason?: string;
        modelPath?: string;
      }>;
      chat: (args: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
      }) => Promise<{ text: string }>;
    };
  }
}
