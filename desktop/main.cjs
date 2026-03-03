const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let llamaSessionPromise = null;
let localPackagedServerStarted = false;

const DEFAULT_MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const DEFAULT_START_URL = 'http://localhost:3000';
const DEFAULT_MAX_TOKENS = 384;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_LOCAL_APP_HOST = '127.0.0.1';
const DEFAULT_LOCAL_APP_PORT = 3210;
const LOCAL_SERVER_START_TIMEOUT_MS = 60000;
const USER_MODEL_CONFIG_FILE = 'local-model-config.json';
const MAX_MODEL_SIZE_B = 3;
const DEFAULT_MODEL_CATALOG = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B Instruct (Q4_K_M)',
    family: 'llama',
    sizeB: 1,
    recommended: true,
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'qwen-2.5-1.5b',
    name: 'Qwen 2.5 1.5B Instruct (Q4_K_M)',
    family: 'qwen',
    sizeB: 1.5,
    file: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B Instruct (Q4_K_M)',
    family: 'llama',
    sizeB: 3,
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'qwen-2.5-3b',
    name: 'Qwen 2.5 3B Instruct (Q4_K_M)',
    family: 'qwen',
    sizeB: 3,
    file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
  },
];

const readRuntimeConfig = () => {

  try {
    const configPath = path.join(__dirname, 'runtime-config.json');
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read desktop runtime config:', error);
    return {};
  }
};

const toIntOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumberOrFallback = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return undefined;
};

const sanitizeModelId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

const resolveModelFileName = (model) => {
  if (model?.file) return String(model.file);

  try {
    const parsed = new URL(String(model?.url || ''));
    const name = path.basename(parsed.pathname || '');
    if (name) return name;
  } catch {}

  return DEFAULT_MODEL_FILE;
};

const readUserModelConfig = () => {
  try {
    const configPath = path.join(app.getPath('userData'), USER_MODEL_CONFIG_FILE);
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeUserModelConfig = (data) => {
  const configPath = path.join(app.getPath('userData'), USER_MODEL_CONFIG_FILE);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
};

const getModelCatalog = () => {
  const runtime = readRuntimeConfig();
  const runtimeModels = Array.isArray(runtime?.models) ? runtime.models : [];

  const normalizedRuntimeModels = runtimeModels
    .map((model) => {
      const id = sanitizeModelId(model?.id || model?.name);
      const sizeB = Number(model?.sizeB);
      const url = String(model?.url || '').trim();
      if (!id || !url || !Number.isFinite(sizeB) || sizeB > MAX_MODEL_SIZE_B) {
        return null;
      }

      return {
        id,
        name: String(model?.name || id),
        family: String(model?.family || 'custom'),
        sizeB,
        recommended: Boolean(model?.recommended),
        file: resolveModelFileName(model),
        url,
      };
    })
    .filter(Boolean);

  if (normalizedRuntimeModels.length > 0) {
    return normalizedRuntimeModels;
  }

  return DEFAULT_MODEL_CATALOG;
};

const getSelectedModelId = () => {
  const envModelId = sanitizeModelId(process.env.LLAMA_MODEL_ID);
  if (envModelId) return envModelId;

  const persisted = sanitizeModelId(readUserModelConfig()?.selectedModelId);
  if (persisted) return persisted;

  const runtime = readRuntimeConfig();
  const runtimeDefault = sanitizeModelId(runtime?.defaultModelId);
  if (runtimeDefault) return runtimeDefault;

  return DEFAULT_MODEL_CATALOG[0].id;
};

const getSelectedModel = () => {
  const catalog = getModelCatalog();
  const selectedId = getSelectedModelId();

  return (
    catalog.find((model) => model.id === selectedId) ||
    catalog[0] || {
      id: 'fallback-default',
      name: 'Llama 3.2 1B Instruct (Q4_K_M)',
      family: 'llama',
      sizeB: 1,
      file: DEFAULT_MODEL_FILE,
      url: '',
    }
  );
};

const getModelCatalogSnapshot = () => {
  const catalog = getModelCatalog();
  const selected = getSelectedModel();
  return {
    models: catalog,
    selectedModelId: selected.id,
  };
};

const getModelStatus = () => {
  const selectedModel = getSelectedModel();
  const modelPath = getModelPath();
  return {
    selectedModel,
    selectedModelId: selectedModel.id,
    modelPath,
    exists: fs.existsSync(modelPath),
    downloadUrl: getModelUrl(),
    ...getModelCatalogSnapshot(),
  };
};

const getPackagedLocalAppUrl = () => {
  const host = process.env.ELECTRON_LOCAL_HOST || DEFAULT_LOCAL_APP_HOST;
  const port = Number(process.env.ELECTRON_LOCAL_PORT || DEFAULT_LOCAL_APP_PORT);
  return `http://${host}:${port}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isUrlReachable = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode) && response.statusCode < 500);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });

    req.on('error', () => resolve(false));
  });

const resolveStandaloneServerPath = () => {
  const candidates = [];

  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar', '.next', 'standalone', 'server.js'),
    );
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js'),
    );
    candidates.push(
      path.join(process.resourcesPath, '.next', 'standalone', 'server.js'),
    );
  } else {
    candidates.push(path.join(__dirname, '..', '.next', 'standalone', 'server.js'));
  }

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
};

const waitForLocalServer = async (baseUrl, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const reachable = await isUrlReachable(`${baseUrl}/api/health`);
    if (reachable) return true;
    await wait(500);
  }
  return false;
};

const ensurePackagedLocalServer = async () => {
  if (localPackagedServerStarted) return getPackagedLocalAppUrl();

  const serverPath = resolveStandaloneServerPath();
  if (!serverPath) {
    throw new Error('Bundled Next standalone server not found in desktop package.');
  }

  const localUrl = getPackagedLocalAppUrl();
  const parsed = new URL(localUrl);
  process.env.PORT = process.env.PORT || parsed.port;
  process.env.HOSTNAME = process.env.HOSTNAME || parsed.hostname;
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';

  require(serverPath);
  localPackagedServerStarted = true;

  const started = await waitForLocalServer(localUrl, LOCAL_SERVER_START_TIMEOUT_MS);
  if (!started) {
    throw new Error('Timed out while starting bundled local app server.');
  }

  return localUrl;
};

const getLlamaRuntimeOptions = () => {
  const runtime = readRuntimeConfig();
  const llamaRuntime = runtime?.llama || {};

  const gpuSettingRaw =
    process.env.LLAMA_GPU ??
    llamaRuntime.gpu ??
    'auto';
  const gpuSetting = String(gpuSettingRaw).trim().toLowerCase();
  const gpu =
    gpuSetting === 'cpu'
      ? false
      : gpuSetting === 'auto'
      ? 'auto'
      : gpuSetting || 'auto';

  const gpuLayersRaw =
    process.env.LLAMA_GPU_LAYERS ??
    llamaRuntime.gpuLayers ??
    'auto';
  const gpuLayersText = String(gpuLayersRaw).trim().toLowerCase();
  const gpuLayersParsed = toIntOrUndefined(gpuLayersRaw);
  const gpuLayers =
    gpuLayersText === 'auto' || gpuLayersText === 'max'
      ? gpuLayersText
      : gpuLayersParsed;

  const contextSize =
    toIntOrUndefined(process.env.LLAMA_CONTEXT_SIZE) ??
    toIntOrUndefined(llamaRuntime.contextSize);
  const batchSize =
    toIntOrUndefined(process.env.LLAMA_BATCH_SIZE) ??
    toIntOrUndefined(llamaRuntime.batchSize);
  const threads =
    toIntOrUndefined(process.env.LLAMA_THREADS) ??
    toIntOrUndefined(llamaRuntime.threads);
  const maxThreads =
    toIntOrUndefined(process.env.LLAMA_MAX_THREADS) ??
    toIntOrUndefined(llamaRuntime.maxThreads);
  const flashAttention =
    toBooleanOrUndefined(process.env.LLAMA_FLASH_ATTENTION) ??
    toBooleanOrUndefined(llamaRuntime.flashAttention);
  const useLastBuild =
    toBooleanOrUndefined(process.env.LLAMA_USE_LAST_BUILD) ??
    toBooleanOrUndefined(llamaRuntime.useLastBuild) ??
    false;
  const maxTokens = toNumberOrFallback(
    process.env.LLAMA_MAX_TOKENS ?? llamaRuntime.maxTokens,
    DEFAULT_MAX_TOKENS,
  );
  const temperature = toNumberOrFallback(
    process.env.LLAMA_TEMPERATURE ?? llamaRuntime.temperature,
    DEFAULT_TEMPERATURE,
  );

  return {
    gpu,
    gpuLayers,
    contextSize,
    batchSize,
    threads,
    maxThreads,
    flashAttention,
    useLastBuild,
    maxTokens,
    temperature,
  };
};

const getModelPath = () => {
  if (process.env.LLAMA_MODEL_PATH) return process.env.LLAMA_MODEL_PATH;
  const selected = getSelectedModel();
  return path.join(app.getPath('userData'), 'models', resolveModelFileName(selected));
};

const getModelUrl = () => {
  if (process.env.LLAMA_MODEL_URL) return process.env.LLAMA_MODEL_URL;
  const selected = getSelectedModel();
  if (selected?.url) return selected.url;
  const runtime = readRuntimeConfig();
  return runtime.modelUrl || '';
};

const ensureModelFile = async () => {
  const modelPath = getModelPath();
  if (fs.existsSync(modelPath)) return modelPath;

  const selected = getSelectedModel();
  const modelUrl = getModelUrl();

  throw new Error(
    `Model file not found at ${modelPath}. Download ${selected?.name || 'the selected model'} manually from ${modelUrl || 'its GGUF source URL'} and place it at this path, or set LLAMA_MODEL_PATH.`,
  );
};

const ensureSession = async () => {
  if (llamaSessionPromise) return llamaSessionPromise;

  llamaSessionPromise = (async () => {
    const modelPath = await ensureModelFile();
    const runtimeOptions = getLlamaRuntimeOptions();

    const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
    const llama = runtimeOptions.useLastBuild
      ? await getLlama('lastBuild')
      : await getLlama({
          gpu: runtimeOptions.gpu,
          maxThreads: runtimeOptions.maxThreads,
        });

    const model = await llama.loadModel({
      modelPath,
      gpuLayers: runtimeOptions.gpuLayers,
    });

    const context = await model.createContext({
      contextSize: runtimeOptions.contextSize,
      batchSize: runtimeOptions.batchSize,
      threads: runtimeOptions.threads,
      flashAttention: runtimeOptions.flashAttention,
    });

    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });

    return { session, modelPath, runtimeOptions };
  })().catch((error) => {
    llamaSessionPromise = null;
    throw error;
  });

  return llamaSessionPromise;
};

ipcMain.handle('local-llm:availability', async () => {
  try {
    const modelPath = getModelPath();
    const selectedModel = getSelectedModel();
    const catalog = getModelCatalogSnapshot();
    const { runtimeOptions } = await ensureSession();
    return {
      available: true,
      modelPath,
      selectedModel,
      modelCatalog: catalog.models,
      selectedModelId: catalog.selectedModelId,
      runtimeOptions,
    };
  } catch (error) {
    const selectedModel = getSelectedModel();
    const catalog = getModelCatalogSnapshot();
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Unknown initialization error',
      modelPath: getModelPath(),
      selectedModel,
      modelCatalog: catalog.models,
      selectedModelId: catalog.selectedModelId,
      runtimeOptions: getLlamaRuntimeOptions(),
    };
  }
});

ipcMain.handle('local-llm:prepare', async () => {
  try {
    const modelPath = await ensureModelFile();
    const selectedModel = getSelectedModel();
    const catalog = getModelCatalogSnapshot();
    return {
      ok: true,
      modelPath,
      selectedModel,
      modelCatalog: catalog.models,
      selectedModelId: catalog.selectedModelId,
      runtimeOptions: getLlamaRuntimeOptions(),
    };
  } catch (error) {
    const selectedModel = getSelectedModel();
    const catalog = getModelCatalogSnapshot();
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown model preparation error',
      modelPath: getModelPath(),
      selectedModel,
      modelCatalog: catalog.models,
      selectedModelId: catalog.selectedModelId,
      runtimeOptions: getLlamaRuntimeOptions(),
    };
  }
});

ipcMain.handle('local-llm:list-models', async () => {
  return getModelCatalogSnapshot();
});

ipcMain.handle('local-llm:model-status', async () => {
  return getModelStatus();
});

ipcMain.handle('local-llm:set-model', async (_event, args) => {
  const requestedId = sanitizeModelId(args?.modelId);
  const catalog = getModelCatalog();
  const target = catalog.find((model) => model.id === requestedId);

  if (!target) {
    return {
      ok: false,
      reason: `Unknown model '${requestedId}'.`,
      ...getModelCatalogSnapshot(),
    };
  }

  writeUserModelConfig({ selectedModelId: target.id });
  llamaSessionPromise = null;

  return {
    ok: true,
    selectedModelId: target.id,
    selectedModel: target,
    models: catalog,
  };
});

ipcMain.handle('local-llm:chat', async (_event, args) => {
  const prompt = args?.prompt?.toString?.() || '';
  if (!prompt.trim()) {
    return { text: '' };
  }

  const { session, runtimeOptions } = await ensureSession();
  const text = await session.prompt(prompt, {
    maxTokens: toNumberOrFallback(args?.maxTokens, runtimeOptions.maxTokens),
    temperature: toNumberOrFallback(args?.temperature, runtimeOptions.temperature),
  });

  return {
    text: text?.toString?.() || '',
  };
});

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#05060a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged && !process.env.ELECTRON_START_URL) {
    try {
      const localUrl = await ensurePackagedLocalServer();
      await mainWindow.loadURL(localUrl);
      return;
    } catch (error) {
      const allowRemoteFallback =
        process.env.ELECTRON_ALLOW_REMOTE_FALLBACK === '1';
      const runtime = readRuntimeConfig();
      const fallbackUrl = runtime.startUrl || '';

      if (allowRemoteFallback && fallbackUrl) {
        await mainWindow.loadURL(fallbackUrl);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown desktop startup error.';
      const html = `
        <html><body style="background:#0b0d12;color:#fff;font-family:sans-serif;padding:24px">
        <h2>Desktop startup failed</h2>
        <p>The bundled local app server could not start.</p>
        <pre>${message}</pre>
        <p>Reinstall the latest desktop build.</p>
        </body></html>`;
      await mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      );
      return;
    }
  }

  const runtime = readRuntimeConfig();
  const startUrl =
    process.env.ELECTRON_START_URL ||
    runtime.startUrl ||
    DEFAULT_START_URL;

  await mainWindow.loadURL(startUrl);
};

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
