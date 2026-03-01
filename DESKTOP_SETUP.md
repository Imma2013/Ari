# Desktop Local AI Setup (Electron + llama.cpp)

This project now supports a desktop mode where Quick Search can run local inference without Ollama.

## What This Uses
- Electron app shell
- `node-llama-cpp` in Electron main process
- Existing UI in renderer
- SearXNG for retrieval

## Install
```bash
npm install
```

## Model setup options (GGUF)
Option A (recommended for friend installs): auto-download on first run
- Set `LLAMA_MODEL_URL` to a direct downloadable `.gguf` URL.
- App downloads once into `<userData>/models/`.

Option B: manual local file
- Set `LLAMA_MODEL_PATH` to a local `.gguf` path.
- If not set, fallback path is `<userData>/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf`.

Examples:
```bash
# Windows PowerShell
$env:LLAMA_MODEL_URL="https://your-model-host/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
npm run desktop:dev
```

```bash
# Or manual model path
$env:LLAMA_MODEL_PATH="C:\models\Llama-3.2-3B-Instruct-Q4_K_M.gguf"
npm run desktop:dev
```

## Run desktop app
```bash
npm run desktop:dev
```

This starts:
1. Next.js on `http://localhost:3000`
2. Electron window with secure preload bridge

## Notes
- No Ollama is required.
- Your friend does not need Ollama.
- For packaged installers, first-run auto-download is easiest.
- Web version keeps WebLLM fallback.
