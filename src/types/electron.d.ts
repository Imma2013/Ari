export {};

interface ElectronLocalModel {
  id: string;
  name: string;
  family: string;
  sizeB: number;
  recommended?: boolean;
  file: string;
  url: string;
}

declare global {
  interface Window {
    electronLLM?: {
      availability: () => Promise<{
        available: boolean;
        reason?: string;
        modelPath?: string;
        selectedModel?: ElectronLocalModel;
        modelCatalog?: ElectronLocalModel[];
        selectedModelId?: string;
      }>;
      prepare: () => Promise<{
        ok: boolean;
        reason?: string;
        modelPath?: string;
        selectedModel?: ElectronLocalModel;
        modelCatalog?: ElectronLocalModel[];
        selectedModelId?: string;
      }>;
      listModels: () => Promise<{
        models: ElectronLocalModel[];
        selectedModelId: string;
      }>;
      setModel: (args: { modelId: string }) => Promise<{
        ok: boolean;
        reason?: string;
        selectedModelId?: string;
        selectedModel?: ElectronLocalModel;
        models?: ElectronLocalModel[];
      }>;
      chat: (args: {
        prompt: string;
        maxTokens?: number;
        temperature?: number;
      }) => Promise<{ text: string }>;
    };
  }
}
