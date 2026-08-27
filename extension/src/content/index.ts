import { findAmazonInsertionPoint, readAmazonProduct } from "../adapters/amazon";
import type { TryOnMessage, TryOnMessageResponse } from "../lib/types";
import styles from "./styles";

const ROOT_ID = "ai-virtual-tryon-root";

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
  const result = shadow.querySelector<HTMLElement>(".tryon-result");
  const status = shadow.querySelector<HTMLElement>(".tryon-status");
  const image = shadow.querySelector<HTMLImageElement>(".tryon-image");

  async function runTryOn(): Promise<void> {
    if (!button || !result || !status || !image) return;
    button.disabled = true;
    result.hidden = false;
    image.hidden = true;
    status.textContent = "Generating preview...";

    const message: TryOnMessage = {
      type: "TRY_ON",
      payload: productSnapshot,
    };
    const response = await chrome.runtime.sendMessage(message) as TryOnMessageResponse;

    if (response.ok) {
      image.src = `data:image/png;base64,${response.data.image_b64}`;
      image.hidden = false;
      status.textContent = `Generated with ${response.data.provider} in ${response.data.latency_ms} ms`;
    } else {
      status.textContent = response.error;
    }
    button.disabled = false;
  }

  button?.addEventListener("click", () => void runTryOn());
  shadow.querySelector('[data-action="regenerate"]')?.addEventListener("click", () => void runTryOn());
  shadow.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    if (result) result.hidden = true;
  });
}

injectTryOnUi();

const observer = new MutationObserver(() => {
  window.setTimeout(injectTryOnUi, 400);
});

observer.observe(document.body, { childList: true, subtree: true });
