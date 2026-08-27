# AI Virtual Try-On — Chrome Extension

Adds a **Try on me** button to Amazon product pages. Upload one photo, click the
button, and a diffusion model renders you wearing the garment.

<p align="center">
  <img src="extension/public/icons/icon-128.png" width="96" alt="Extension icon" />
</p>

Chrome MV3 · TypeScript · React · Vite · Fastify · Node 20 · Hugging Face IDM-VTON

---

## How it works

A Chrome extension and a small Node service. The backend is not optional plumbing —
it exists because three things are impossible from inside the browser:

- **Secrets.** An API key shipped in an extension is readable by anyone who unpacks it.
- **CORS.** The page context cannot read Amazon's product images cross-origin.
- **Quota.** A shared GPU pool needs request coalescing that no single tab can do.

```
Popup ──► chrome.storage.local ──┐
                                 ▼
Content script ──► Service worker ──► Fastify ──► Provider ──► IDM-VTON
   (scrape + UI)      (network)      (validate,     (mock /
                                      guard, cache)  HF / Gemini)
```

Full write-up with a Mermaid diagram, the runtime split, and the threat model:
**[`docs/architecture.md`](./docs/architecture.md)**.
Roadmap: [`PLAN.md`](./PLAN.md).

---

## Setup

Requires **Node 20+**. If `pnpm` is missing, `corepack enable pnpm` or substitute `npm`.

### 1. Backend

```powershell
cd backend
pnpm install
copy .env.example .env     # then edit
pnpm build
pnpm start
```

Health check:

```powershell
curl http://127.0.0.1:8000/api/health
```

It runs on the **mock provider** out of the box — no keys, no network, real
end-to-end responses. Switch to real generation by editing `.env`:

```ini
PROVIDER=huggingface
USE_MOCK_PROVIDER=false
HF_TOKEN=hf_...      # optional, see below
```

### 2. Extension

```powershell
cd extension
pnpm install
pnpm build
```

Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `extension/dist`.

Then open the popup, upload one clear full-body photo, and visit any
`amazon.in` / `amazon.com` product page.

---

## Providers

| Provider | Cost | Notes |
| --- | --- | --- |
| `mock` | Free | Offline compositing. Default. Good for development and tests. |
| `huggingface` | Free | [IDM-VTON](https://huggingface.co/spaces/yisol/IDM-VTON) on ZeroGPU. ~25–70s per image. |
| `gemini` | Paid | Gemini 2.5 Flash Image. Image generation returns **HTTP 429** on the free tier. |

### Hugging Face quota

ZeroGPU enforces a **per-account** daily quota shared across every ZeroGPU Space,
on a rolling 24-hour reset. When the token's quota is spent, the provider
automatically retries **without** a token — anonymous access uses a separate
IP-keyed pool. That pool is smaller, so treat it as a safety net, not a supply.

Running with no `HF_TOKEN` at all works and goes straight to the guest pool.

---

## Quota protection

Generation is the scarce resource, so three layers guard it:

| Layer | Where | Effect |
| --- | --- | --- |
| Button state + `inFlight` flag | `content/index.ts` | No overlapping requests from one page |
| In-flight coalescing | `services/cache.ts` | N identical concurrent requests → 1 generation |
| LRU + TTL cache | `services/cache.ts` | Repeat requests cost nothing |

The cache key is `sha256` over the **normalized** user image, product URL, category,
title, `PROMPT_VERSION`, provider, and denoise steps — so it stays stable across
client re-encodes and invalidates when the prompt changes.

---

## Security

The `product_image_url` field is caller-supplied, which makes the naive
implementation an open proxy. `services/url-guard.ts` enforces:

- https only, no embedded credentials
- host allowlist (`ALLOWED_IMAGE_HOSTS`, Amazon CDNs by default)
- DNS resolution with private-range rejection — blocks loopback, RFC1918, CGNAT,
  and the cloud metadata endpoint `169.254.169.254`
- manual redirect following, re-validating every hop
- a 15s `AbortSignal.timeout` on every outbound fetch

CORS is restricted to `chrome-extension://*` and localhost origins.

> The API has **no authentication** and binds to `127.0.0.1`. It is a local
> development server and is not safe to expose publicly as-is.

---

## Tests

```powershell
cd backend
pnpm test        # 24 tests
pnpm typecheck
```

Covers the HTTP surface, cache semantics (coalescing, TTL, LRU eviction,
failure-not-cached), URL-guard rejections, and prompt/category resolution.

---

## Licensing

The code in this repository is a personal portfolio project.

**The model is not.** [IDM-VTON](https://huggingface.co/yisol/IDM-VTON) is released
under **CC BY-NC-SA 4.0** — *NonCommercial*. Using this project for anything
commercial would require a different model. Cite the authors if you build on it:

> Choi et al., *Improving Diffusion Models for Authentic Virtual Try-on in the Wild*,
> [arXiv:2403.05139](https://arxiv.org/abs/2403.05139) (2024).

---

## Limitations

- Amazon only — `adapters/amazon.ts` is the single adapter, and DOM selectors break
  when Amazon reskins.
- IDM-VTON rejects photos where it cannot detect a person; a plain background and a
  full-body shot work best.
- The cache is in-memory and single-process.
- Category inference is regex-based on the product title, not visual.
