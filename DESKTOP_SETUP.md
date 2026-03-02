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
- If not set, fallback path is `<userData>/models/Llama-3.2-1B-Instruct-Q4_K_M.gguf`.

Option C (recommended): use built-in model catalog with 3B cap
- Configure `desktop/runtime-config.json` `models` list.
- Set `defaultModelId`.
- Or override with env `LLAMA_MODEL_ID`.
- Runtime enforces `sizeB <= 3`.

Examples:
```bash
# Windows PowerShell
$env:LLAMA_MODEL_URL="https://your-model-host/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
npm run desktop:dev
```

```bash
# Or manual model path
$env:LLAMA_MODEL_PATH="C:\models\Llama-3.2-1B-Instruct-Q4_K_M.gguf"
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
  "defaultModelId": "llama-3.2-1b",
  "models": [
    {
      "id": "llama-3.2-1b",
      "name": "Llama 3.2 1B Instruct (Q4_K_M)",
      "family": "llama",
      "sizeB": 1,
      "file": "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      "url": "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    }
  ],
  "llama": {
    "gpu": "auto",
    "gpuLayers": "auto",
    "contextSize": 2048,
    "batchSize": 512,
    "threads": 8,
    "flashAttention": true,
    "maxTokens": 384,
    "temperature": 0.2
  }
}
```

### Performance knobs (no code changes needed)
You can tune local inference speed/latency using env vars or `runtime-config.json` (`llama` block above):

- `LLAMA_GPU` = `auto` | `cpu` | `metal` | `cuda` | `vulkan` | `rocm`
- `LLAMA_MODEL_ID` = model id from `models` list (for example `llama-3.2-3b`)
- `LLAMA_GPU_LAYERS` = `auto` | `max` | number
- `LLAMA_CONTEXT_SIZE` = number
- `LLAMA_BATCH_SIZE` = number
- `LLAMA_THREADS` = number
- `LLAMA_MAX_THREADS` = number
- `LLAMA_FLASH_ATTENTION` = `true` | `false`
- `LLAMA_MAX_TOKENS` = number
- `LLAMA_TEMPERATURE` = number
- `LLAMA_USE_LAST_BUILD` = `true` | `false`

For quick search responsiveness with 1B, start with:
- `gpu=auto`
- `gpuLayers=auto`
- `contextSize=2048`
- `batchSize=512`
- `maxTokens=256-384`

## Built-in 3B-or-smaller model set
- `llama-3.2-1b`
- `qwen-2.5-1.5b`
- `llama-3.2-3b`
- `qwen-2.5-3b`

## Build Windows installer
```bash
npm install
npm run desktop:dist:win
```

Output:
- `dist-desktop/*.exe` (NSIS installer)

## Deploy-first test flow (no localhost dependency)
1. Deploy web app to Vercel and copy your live URL.
2. Set `desktop/runtime-config.json`:
   - `startUrl` to your Vercel URL
   - `modelUrl` to the 1B GGUF direct link
3. Build installer: `npm run desktop:dist:win`
4. Install on target machine and launch the desktop app.
5. Run Quick Search and confirm first-run model download + local answer.

## How to make a valid model URL
Use a direct file URL (not a webpage). For Hugging Face, use:
```text
https://huggingface.co/<org-or-user>/<repo>/resolve/main/<file>.gguf
```

Example pattern:
```text
https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf
```

You can also host the `.gguf` on Cloudflare R2, S3, or any static file host with direct download enabled.
