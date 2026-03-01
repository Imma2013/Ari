const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow = null;
let llamaSessionPromise = null;
let modelDownloadPromise = null;

const DEFAULT_MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const DEFAULT_START_URL = 'http://localhost:3000';
const DEFAULT_MAX_TOKENS = 384;
const DEFAULT_TEMPERATURE = 0.2;

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
  return path.join(app.getPath('userData'), 'models', DEFAULT_MODEL_FILE);
};

const getModelUrl = () => {
  const runtime = readRuntimeConfig();
  return process.env.LLAMA_MODEL_URL || runtime.modelUrl || '';
};

const downloadFile = (url, destinationPath) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const request = client.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.destroy();
        downloadFile(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(`Model download failed with status ${response.statusCode}`),
        );
        return;
      }

      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      const tempPath = `${destinationPath}.download`;
      const fileStream = fs.createWriteStream(tempPath);

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          fs.renameSync(tempPath, destinationPath);
          resolve(destinationPath);
        });
      });

      fileStream.on('error', (err) => {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
        reject(err);
      });
    });

    request.on('error', reject);
  });

const ensureModelFile = async () => {
  const modelPath = getModelPath();
  if (fs.existsSync(modelPath)) return modelPath;

  const modelUrl = getModelUrl();
  if (!modelUrl) {
    throw new Error(
      `Model file not found at ${modelPath}. Set LLAMA_MODEL_URL for auto-download or LLAMA_MODEL_PATH for manual model location.`,
    );
  }

  if (!modelDownloadPromise) {
    modelDownloadPromise = downloadFile(modelUrl, modelPath).finally(() => {
      modelDownloadPromise = null;
    });
  }

  await modelDownloadPromise;
  return modelPath;
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
    const { runtimeOptions } = await ensureSession();
    return {
      available: true,
      modelPath,
      runtimeOptions,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Unknown initialization error',
      modelPath: getModelPath(),
      runtimeOptions: getLlamaRuntimeOptions(),
    };
  }
});

ipcMain.handle('local-llm:prepare', async () => {
  try {
    const modelPath = await ensureModelFile();
    return { ok: true, modelPath, runtimeOptions: getLlamaRuntimeOptions() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown model preparation error',
      modelPath: getModelPath(),
      runtimeOptions: getLlamaRuntimeOptions(),
    };
  }
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
