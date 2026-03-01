const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow = null;
let llamaSessionPromise = null;
let modelDownloadPromise = null;

const DEFAULT_MODEL_FILE = 'Llama-3.2-3B-Instruct-Q4_K_M.gguf';

const getModelPath = () => {
  if (process.env.LLAMA_MODEL_PATH) return process.env.LLAMA_MODEL_PATH;
  return path.join(app.getPath('userData'), 'models', DEFAULT_MODEL_FILE);
};

const getModelUrl = () => process.env.LLAMA_MODEL_URL || '';

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

    const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
    const llama = await getLlama();
    const model = await llama.loadModel({
      modelPath,
    });
    const context = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });

    return { session, modelPath };
  })().catch((error) => {
    llamaSessionPromise = null;
    throw error;
  });

  return llamaSessionPromise;
};

ipcMain.handle('local-llm:availability', async () => {
  try {
    const modelPath = getModelPath();
    await ensureSession();
    return {
      available: true,
      modelPath,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Unknown initialization error',
      modelPath: getModelPath(),
    };
  }
});

ipcMain.handle('local-llm:prepare', async () => {
  try {
    const modelPath = await ensureModelFile();
    return { ok: true, modelPath };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown model preparation error',
      modelPath: getModelPath(),
    };
  }
});

ipcMain.handle('local-llm:chat', async (_event, args) => {
  const prompt = args?.prompt?.toString?.() || '';
  if (!prompt.trim()) {
    return { text: '' };
  }

  const { session } = await ensureSession();
  const text = await session.prompt(prompt, {
    maxTokens: Number(args?.maxTokens || 512),
    temperature: Number(args?.temperature || 0.2),
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

  const startUrl =
    process.env.ELECTRON_START_URL ||
    'http://localhost:3000';

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
