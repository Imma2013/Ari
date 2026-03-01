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

## Required model file (GGUF)
Place a GGUF model at one of these locations:
- `LLAMA_MODEL_PATH` env var (recommended)
- Default fallback: `<userData>/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf`

Example:
```bash
# Windows PowerShell
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
- Your friend still needs the model file distributed with the app (or downloaded on first run).
- Web version keeps WebLLM fallback.
