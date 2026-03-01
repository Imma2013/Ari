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

## Configure installer defaults (no env needed for friend)
Edit:
- `desktop/runtime-config.json`

Set:
```json
{
  "startUrl": "https://your-vercel-domain.vercel.app",
  "modelUrl": "https://your-direct-download-host/model.gguf"
}
```

## Build Windows installer
```bash
npm install
npm run desktop:dist:win
```

Output:
- `dist-desktop/*.exe` (NSIS installer)

## How to make a valid model URL
Use a direct file URL (not a webpage). For Hugging Face, use:
```text
https://huggingface.co/<org-or-user>/<repo>/resolve/main/<file>.gguf
```

Example pattern:
```text
https://huggingface.co/mradermacher/Meta-Llama-3.2-3B-Instruct-GGUF/resolve/main/Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf
```

You can also host the `.gguf` on Cloudflare R2, S3, or any static file host with direct download enabled.
