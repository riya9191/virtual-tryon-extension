# AI-Powered Virtual Try-On Chrome Extension — Detailed Plan

> **Owner:** Riya Padhi
> **Status:** Planning → Phase 0
> **Target timeline (resume):** Jan–Feb 2026 (MVP in ~4–6 weeks of part-time work)

---

## 1. Product Summary

A Manifest v3 Chrome extension that lets a shopper on **Amazon (.in / .com)** click a "Try it on me" button on any clothing product page. The extension:
1. Grabs the product image(s) from the Amazon DOM.
2. Sends them along with the user's stored selfie/full-body photo to a **FastAPI** backend.
3. Backend calls a **multimodal LLM (Google Gemini 2.5 Flash Image — "Nano Banana")** to (a) understand the garment and (b) generate a try-on image showing the user wearing the product.
4. The generated image is rendered as an **in-page overlay preview** next to the product.

---

## 2. Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Extension | **Chrome Manifest v3**, **TypeScript**, **Vite** + `@crxjs/vite-plugin` | Modern MV3 toolchain, HMR for content scripts |
| UI (popup + overlay) | **React 18** + **Tailwind CSS** | Fast iteration, small bundle |
| Backend | **Python 3.11 + FastAPI + Uvicorn** | Matches resume, async, easy LLM integration |
| LLM Provider | **Google Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) via `google-genai` SDK | Free tier, native image-editing/composition |
| Provider abstraction | `BaseTryOnProvider` interface | Swap to HuggingFace IDM-VTON / Replicate later |
| Storage (user photo) | `chrome.storage.local` (base64) for MVP | No server-side PII storage |
| Image handling | Pillow (backend), Canvas API (extension) | Resize / compress before upload |
| Marketplace | **Amazon only** (`amazon.in`, `amazon.com`) | Single DOM adapter for MVP |
| Auth | None for MVP (single-user local) | Add later if hosted |
| Dev | Node 20, Python 3.11, pnpm, ruff, black, eslint | — |

---

## 3. Repository Layout (already created)

```
virtual-tryon-extension/
├── PLAN.md                  ← this file
├── README.md                ← user-facing setup (to write in Phase 1)
├── .gitignore
├── extension/               ← Chrome MV3 extension (TS + React + Vite)
│   ├── manifest.json
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/icons/        ← 16/48/128 px icons
│   └── src/
│       ├── background/      ← service worker (MV3)
│       ├── content/         ← injected on amazon.* — DOM scraping + overlay
│       ├── popup/           ← React popup (upload selfie, settings, history)
│       ├── adapters/        ← amazon.ts (product image + insertion point)
│       └── lib/             ← api client, storage, image utils, types
├── backend/                 ← FastAPI service
│   ├── pyproject.toml
│   ├── .env.example         ← GEMINI_API_KEY=...
│   └── app/
│       ├── main.py          ← FastAPI app + CORS for chrome-extension://
│       ├── routers/         ← /tryon, /health
│       ├── services/        ← orchestration (understand → generate)
│       ├── providers/       ← base.py, gemini.py (later: huggingface.py)
│       ├── schemas/         ← Pydantic request/response models
│       └── tests/
├── docs/                    ← architecture diagram, prompts, demo gifs
└── samples/                 ← test selfies + product images for local dev
```

---

## 4. Phased Roadmap

### Phase 0 — Setup & Accounts  *(½ day)*
- [ ] Install Node 20, Python 3.11, pnpm, VS Code extensions (ESLint, Prettier, Pylance, Ruff).
- [ ] Get **Gemini API key** from https://aistudio.google.com/apikey (free, no credit card).
- [ ] `git init`, push to GitHub repo `virtual-tryon-extension` (private at first).
- [ ] Read Gemini Image docs once: https://ai.google.dev/gemini-api/docs/image-generation
- [ ] Confirm free-tier limits (currently ~RPM/RPD limits — fine for dev).

**Exit criteria:** Empty repo on GitHub, `GEMINI_API_KEY` saved in a password manager, a "hello world" `curl` call to Gemini returns an image.

---

### Phase 1 — Backend MVP  *(3–4 days)*
Goal: a single HTTP endpoint that, given a user photo + product photo, returns a try-on image.

1. **Init Python project**
   - `cd backend && python -m venv .venv && .venv\Scripts\activate`
   - `pip install fastapi uvicorn[standard] google-genai pillow python-multipart pydantic-settings`
   - Create `pyproject.toml`, `.env.example`, `.gitignore`.
2. **Pydantic schemas** (`schemas/tryon.py`)
   - `TryOnRequest { user_image_b64: str, product_image_url: str, product_title: str, category: str|None }`
   - `TryOnResponse { image_b64: str, prompt_used: str, latency_ms: int, provider: str }`
3. **Provider interface** (`providers/base.py`)
   - `class BaseTryOnProvider(ABC): async def generate(self, user_img: bytes, product_img: bytes, meta: dict) -> bytes`
4. **Gemini provider** (`providers/gemini.py`)
   - Use `google.genai.Client(api_key=...)`.
   - Call `client.models.generate_content(model="gemini-2.5-flash-image", contents=[user_pil, product_pil, prompt])`.
   - Prompt template (v1, iterate later):
     > *"Generate a photorealistic image of the person in the first image wearing the garment shown in the second image. Preserve the person's face, hair, body proportions, skin tone, and pose. Adapt the garment's fit naturally to the person's body. Keep the background clean and neutral. Do not add text or watermarks."*
   - Return the first `inline_data` image part as bytes.
5. **Orchestration service** (`services/tryon_service.py`)
   - Validate inputs, downscale images to max 1024px (Pillow), call provider, time the call.
6. **Router** (`routers/tryon.py`)
   - `POST /api/tryon` → accepts JSON with base64 user image + product image URL.
   - Fetch product image server-side with `httpx` (avoids CORS on extension side).
7. **CORS** for `chrome-extension://*` in `main.py`.
8. **Local test**: `uvicorn app.main:app --reload`, hit `/api/tryon` with a saved selfie + Amazon image URL via `curl` or Postman.
9. **Unit tests** (`tests/test_tryon.py`) — mock the provider, assert schema validation, error paths.

**Exit criteria:** `POST /api/tryon` returns a valid base64 PNG try-on image within ~5–15s on a real Amazon product URL.

---

### Phase 2 — Extension Scaffold  *(2 days)*
1. `cd extension && pnpm create vite . --template react-ts` then add `@crxjs/vite-plugin`.
2. Write `manifest.json` (MV3):
   ```json
   {
     "manifest_version": 3,
     "name": "AI Virtual Try-On",
     "version": "0.1.0",
     "action": { "default_popup": "src/popup/index.html" },
     "background": { "service_worker": "src/background/index.ts", "type": "module" },
     "content_scripts": [{
       "matches": ["https://www.amazon.in/*", "https://www.amazon.com/*"],
       "js": ["src/content/index.ts"],
       "run_at": "document_idle"
     }],
     "permissions": ["storage", "activeTab", "scripting"],
     "host_permissions": ["https://www.amazon.in/*", "https://www.amazon.com/*", "http://localhost:8000/*"]
   }
   ```
3. **Popup** (`src/popup`)
   - React page with: selfie upload (drag/drop) → preview → save to `chrome.storage.local`.
   - Settings: backend URL (default `http://localhost:8000`).
4. **Background SW** (`src/background/index.ts`)
   - Message bus: receives `{type:"TRY_ON", payload}` from content script, calls backend, returns image.
   - Keeps API URL & user photo in one place (content script asks SW, not storage directly).
5. **Lib** (`src/lib/`)
   - `api.ts` — `tryOn(userImgB64, productUrl, meta)` → POST to backend.
   - `storage.ts` — typed wrapper around `chrome.storage.local`.
   - `image.ts` — resize/compress via OffscreenCanvas before sending.
6. Build & **load unpacked** in `chrome://extensions` (Developer mode on).

**Exit criteria:** Extension loads, popup saves a selfie, background SW can call backend and receive an image (tested with a hardcoded product URL).

---

### Phase 3 — Amazon Adapter & In-Page UI  *(2–3 days)*
1. **Amazon adapter** (`src/adapters/amazon.ts`)
   - `getProductImage()` → reads `#landingImage` (or `#imgTagWrapperId img`) `src`/`data-old-hires`.
   - `getProductTitle()` → `#productTitle`.
   - `getInsertionPoint()` → `#imageBlock` sibling for the "Try on me" button + overlay panel.
   - Detect category (rough heuristic from breadcrumbs / title) — pass to backend.
2. **Content script** (`src/content/index.ts`)
   - On page load, run adapter, inject a floating **"👗 Try on me"** button.
   - On click: show loading shimmer overlay → message SW → render returned image in a side panel with "Save", "Regenerate", "Close".
3. **Styling**
   - Use a Shadow DOM root to isolate styles from Amazon's CSS.
   - Tailwind built to a single CSS string and injected into the shadow root.
4. **SPA-safe**
   - Amazon partially uses pushState; use a `MutationObserver` on `#dp` to re-inject on navigation.

**Exit criteria:** On any Amazon clothing PDP, the button appears, click → try-on image renders in ≤ 15s.

---

### Phase 4 — Prompt & Quality Iteration  *(2 days, ongoing)*
1. Build a small **eval harness** (`backend/tests/eval/`) with 10 fixed (selfie, product) pairs in `samples/`.
2. Run them through 3–4 prompt variants; save outputs to `samples/eval-runs/` with timestamp + prompt hash.
3. Score manually (1–5) on: face preservation, garment accuracy, realism, artifacts.
4. Lock the best prompt; document in `docs/prompts.md`.
5. Add a category-aware prompt switch (tops vs dresses vs pants vs shoes) — small per-category nudges.
6. Optional: pre-process — auto-detect garment type from the product image with a quick Gemini text call.

**Exit criteria:** Average eval score ≥ 4/5 across the 10 test pairs.

---

### Phase 5 — Hardening & Polish  *(2 days)*
- [ ] Loading states, error toasts ("Couldn't read product image", "Backend offline", "Rate limit hit").
- [ ] Retry with exponential backoff on Gemini 429.
- [ ] Client-side image compression to keep payloads < 1 MB.
- [ ] Cache results: key = `sha256(userImg + productUrl + promptVersion)` in `chrome.storage.local` (LRU, 20 items).
- [ ] Privacy notice in popup: photo never leaves device except for the try-on call; not stored on server.
- [ ] Lint/format: `eslint`, `prettier`, `ruff`, `black`.
- [ ] Pre-commit hook (`husky` + `lint-staged`).
- [ ] GitHub Actions CI: lint + pytest + extension build.

---

### Phase 6 — Demo Assets & README  *(½ day)*
- [ ] Record a 30–60s screen capture (ScreenToGif) on a real Amazon PDP. Save to `docs/demo.gif`.
- [ ] Write top-level `README.md`: hero gif, features, architecture diagram, setup (backend + extension), env vars, limitations, roadmap.
- [ ] Architecture diagram (`docs/architecture.png`) — draw.io / Excalidraw, export PNG.
- [ ] Push, make repo public, pin on GitHub profile.
- [ ] Add link to LinkedIn featured section.

**Exit criteria:** A stranger can clone the repo and get it running in ≤ 10 minutes from the README alone.

---

### Phase 7 (Stretch) — Nice-to-Haves
- Myntra / Flipkart adapters (new files in `src/adapters/`, no other code changes).
- Background removal on user selfie (rembg / Gemini) for cleaner composites.
- Multiple poses (front/side) — call Gemini twice, show a carousel.
- Deploy backend on Render/Fly.io free tier so the extension works without `localhost`.
- Replace Gemini with open-source **IDM-VTON** on a HuggingFace Space when free quota runs out.

---

## 5. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gemini free-tier rate limits hit during demo | Med | Result cache + friendly error + fall back to last cached image |
| Amazon DOM changes break adapter | Med | Adapter is a single small file; multiple selector fallbacks; `MutationObserver` + telemetry log |
| Generated face doesn't match user (identity drift) | High | Strong prompt anchoring; later: face-swap post-pass with `insightface` |
| Product image is low-res / has model already wearing it | High | Try cropping to garment only; if multiple images on PDP, prefer the flat-lay one |
| CORS / Amazon hotlink protection on images | Low | Fetch product image **server-side** in FastAPI, not from content script |
| Storing selfie raises privacy concerns | Low | Local-only (`chrome.storage.local`); clear "Delete my photo" button; documented in README |

---

## 6. Definition of Done (MVP)

1. Loaded as unpacked extension in Chrome.
2. User uploads a selfie once via the popup.
3. On any `amazon.in` or `amazon.com` clothing PDP, a "Try on me" button appears.
4. Click → within 15s, a realistic try-on image overlays the product area.
5. README + demo gif on a public GitHub repo.
6. Linked from LinkedIn + resume.

---

## 7. Immediate Next Actions (do these next)

1. Get Gemini API key from AI Studio.
2. `git init` in this folder, first commit with `PLAN.md`.
3. Start **Phase 1, step 1** (init Python venv + install deps).

> When you're ready to start Phase 1, say "let's start phase 1" and I'll scaffold the backend code.
