import toml from '@iarna/toml';

let fs: any;
let path: any;
if (typeof window === 'undefined') {
  fs = require('fs');
  path = require('path');
}

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    SIMILARITY_MEASURE: string;
    KEEP_ALIVE: string;
  };
  MODELS: {
    OPENAI: { API_KEY: string };
    GROQ: { API_KEY: string };
    OPENROUTER: { API_KEY: string };
    ANTHROPIC: { API_KEY: string };
    GEMINI: { API_KEY: string };
    OLLAMA: { API_URL: string };
    DEEPSEEK: { API_KEY: string };
    LM_STUDIO: { API_URL: string };
    CUSTOM_OPENAI: {
      API_URL: string;
      API_KEY: string;
      MODEL_NAME: string;
    };
  };
  API_ENDPOINTS: {
    SEARXNG: string;
  };
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

const defaultConfig: Config = {
  GENERAL: {
    SIMILARITY_MEASURE: 'cosine',
    KEEP_ALIVE: '5m',
  },
  MODELS: {
    OPENAI: { API_KEY: '' },
    GROQ: { API_KEY: '' },
    OPENROUTER: { API_KEY: '' },
    ANTHROPIC: { API_KEY: '' },
    GEMINI: { API_KEY: '' },
    OLLAMA: { API_URL: '' },
    DEEPSEEK: { API_KEY: '' },
    LM_STUDIO: { API_URL: '' },
    CUSTOM_OPENAI: {
      API_URL: '',
      API_KEY: '',
      MODEL_NAME: '',
    },
  },
  API_ENDPOINTS: {
    SEARXNG: 'http://localhost:4000',
  },
};

const mergeConfigs = (current: any, update: any): any => {
  if (update === null || update === undefined) return current;
  if (typeof current !== 'object' || current === null) return update;

  const result = { ...current };
  for (const key in update) {
    if (!Object.prototype.hasOwnProperty.call(update, key)) continue;
    const updateValue = update[key];
    if (
      typeof updateValue === 'object' &&
      updateValue !== null &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key] = mergeConfigs(result[key], updateValue);
    } else if (updateValue !== undefined) {
      result[key] = updateValue;
    }
  }
  return result;
};

const loadConfig = (): Config => {
  if (typeof window !== 'undefined') {
    return defaultConfig;
  }

  try {
    const configPath = path.join(process.cwd(), configFileName);
    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }

    const parsed = toml.parse(fs.readFileSync(configPath, 'utf-8')) as any as Config;
    return mergeConfigs(defaultConfig, parsed) as Config;
  } catch (error) {
    console.warn('Failed to load config.toml, using defaults:', error);
    return defaultConfig;
  }
};

const fromEnv = (key: string, fallback: string) => process.env[key] || fallback;

export const getSimilarityMeasure = () =>
  fromEnv('SIMILARITY_MEASURE', loadConfig().GENERAL.SIMILARITY_MEASURE);

export const getKeepAlive = () =>
  fromEnv('OLLAMA_KEEP_ALIVE', loadConfig().GENERAL.KEEP_ALIVE);

export const getOpenaiApiKey = () =>
  fromEnv('OPENAI_API_KEY', loadConfig().MODELS.OPENAI.API_KEY);

export const getGroqApiKey = () =>
  fromEnv('GROQ_API_KEY', loadConfig().MODELS.GROQ.API_KEY);

export const getOpenrouterApiKey = () =>
  fromEnv('OPENROUTER_API_KEY', loadConfig().MODELS.OPENROUTER.API_KEY);

export const getAnthropicApiKey = () =>
  fromEnv('ANTHROPIC_API_KEY', loadConfig().MODELS.ANTHROPIC.API_KEY);

export const getGeminiApiKey = () =>
  fromEnv('GEMINI_API_KEY', loadConfig().MODELS.GEMINI.API_KEY);

export const getSearxngApiEndpoint = () =>
  fromEnv('SEARXNG_API_URL', loadConfig().API_ENDPOINTS.SEARXNG);

export const getOllamaApiEndpoint = () =>
  fromEnv('OLLAMA_API_URL', loadConfig().MODELS.OLLAMA.API_URL);

export const getDeepseekApiKey = () =>
  fromEnv('DEEPSEEK_API_KEY', loadConfig().MODELS.DEEPSEEK.API_KEY);

export const getCustomOpenaiApiKey = () =>
  fromEnv('CUSTOM_OPENAI_API_KEY', loadConfig().MODELS.CUSTOM_OPENAI.API_KEY);

export const getCustomOpenaiApiUrl = () =>
  fromEnv('CUSTOM_OPENAI_API_URL', loadConfig().MODELS.CUSTOM_OPENAI.API_URL);

export const getCustomOpenaiModelName = () =>
  fromEnv('CUSTOM_OPENAI_MODEL_NAME', loadConfig().MODELS.CUSTOM_OPENAI.MODEL_NAME);

export const getLMStudioApiEndpoint = () =>
  fromEnv('LM_STUDIO_API_URL', loadConfig().MODELS.LM_STUDIO.API_URL);

export const updateConfig = (config: RecursivePartial<Config>) => {
  if (typeof window !== 'undefined') return;

  const configPath = path.join(process.cwd(), configFileName);
  const currentConfig = loadConfig();
  const mergedConfig = mergeConfigs(currentConfig, config);

  try {
    fs.writeFileSync(configPath, toml.stringify(mergedConfig));
  } catch (error) {
    // On platforms with read-only filesystem (for example Vercel runtime),
    // we intentionally keep runtime stable and skip local file persistence.
    console.warn('Skipping config.toml write:', error);
  }
};

