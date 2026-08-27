import { findAmazonInsertionPoint, readAmazonProduct } from "../adapters/amazon";
import type { TryOnMessage, TryOnMessageResponse } from "../lib/types";
import styles from "./styles";

const ROOT_ID = "ai-virtual-tryon-root";
const REINJECT_DELAY_MS = 400;

function injectTryOnUi(): void {
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const snapshot = readAmazonProduct();
  if (!snapshot) {
    return;
  }
  const productSnapshot = snapshot;

  const host = document.createElement("div");
  host.id = ROOT_ID;
  findAmazonInsertionPoint().append(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>${styles}</style>
    <section class="tryon-panel" aria-live="polite">
      <button class="tryon-button" type="button">Try on me</button>
      <div class="tryon-result" hidden>
        <div class="tryon-status">Ready</div>
        <img class="tryon-image" alt="Generated virtual try-on preview" hidden />
        <div class="tryon-actions">
          <button class="tryon-secondary" type="button" data-action="close">Close</button>
          <button class="tryon-secondary" type="button" data-action="regenerate">Regenerate</button>
        </div>
      </div>
    </section>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".tryon-button");
  const regenerate = shadow.querySelector<HTMLButtonElement>('[data-action="regenerate"]');
  const result = shadow.querySelector<HTMLElement>(".tryon-result");
  const status = shadow.querySelector<HTMLElement>(".tryon-status");
  const image = shadow.querySelector<HTMLImageElement>(".tryon-image");

  // Each generation costs a slot from a limited shared GPU quota, so overlapping
  // requests are dropped rather than queued.
  let inFlight = false;

  function setBusy(busy: boolean): void {
    inFlight = busy;
    if (button) button.disabled = busy;
    if (regenerate) regenerate.disabled = busy;
  }

  async function runTryOn(): Promise<void> {
    if (!button || !result || !status || !image) return;
    if (inFlight) return;

    setBusy(true);
    result.hidden = false;
    image.hidden = true;
    status.textContent = "Generating preview...";

    const message: TryOnMessage = {
      type: "TRY_ON",
      payload: productSnapshot,
    };

    try {
      const response = (await chrome.runtime.sendMessage(message)) as TryOnMessageResponse;

      if (response.ok) {
        image.src = `data:image/png;base64,${response.data.image_b64}`;
        image.hidden = false;
        const suffix = response.data.cached ? " (cached)" : "";
        status.textContent = `Generated with ${response.data.provider} in ${response.data.latency_ms} ms${suffix}`;
      } else {
        status.textContent = response.error;
      }
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not reach the try-on backend";
    } finally {
      // Runs even when the backend throws, so the panel can never latch closed.
      setBusy(false);
    }
  }

  button?.addEventListener("click", () => void runTryOn());
  regenerate?.addEventListener("click", () => void runTryOn());
  shadow.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    if (result) result.hidden = true;
  });
}

injectTryOnUi();

// Amazon re-renders large parts of the page, so the panel has to be re-injected.
// A single trailing timer keeps this to one scheduled call regardless of how
// many mutations fire, instead of one timer per mutation.
let reinjectTimer: number | undefined;

const observer = new MutationObserver(() => {
  if (reinjectTimer !== undefined) return;
  if (document.getElementById(ROOT_ID)) return;

  reinjectTimer = window.setTimeout(() => {
    reinjectTimer = undefined;
    injectTryOnUi();
  }, REINJECT_DELAY_MS);
});

observer.observe(document.body, { childList: true, subtree: true });
