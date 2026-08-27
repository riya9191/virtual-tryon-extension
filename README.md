# AI-Powered Virtual Try-On Chrome Extension

A Manifest v3 Chrome extension + Node/TypeScript backend that uses **Google Gemini 2.5 Flash Image** to generate virtual try-on previews directly on Amazon product pages.

> 🚧 **Status:** Planning complete. See [`PLAN.md`](./PLAN.md) for the full step-by-step roadmap.

## Quick Links
- 📋 [Detailed Plan](./PLAN.md)
- 🏗️ Architecture diagram — *coming in Phase 6*
- 🎥 Demo — *coming in Phase 6*

## Stack
Chrome MV3 · TypeScript · React · Vite · Fastify · Node 20 · Google Gemini 2.5 Flash Image

## Local Development

### Backend

```powershell
cd D:\virtual-tryon-extension\backend
pnpm install
pnpm build
pnpm start
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/health
```

The backend uses the mock provider by default. To enable Gemini, copy `backend/.env.example` to `backend/.env`, set `GEMINI_API_KEY`, and change `USE_MOCK_PROVIDER=false`.

### Extension

```powershell
cd D:\virtual-tryon-extension\extension
pnpm install
pnpm build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select:

```text
D:\virtual-tryon-extension\extension\dist
```
