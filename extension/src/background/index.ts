import { requestTryOn } from "../lib/api";
import { getSettings } from "../lib/storage";
import type { TryOnMessage, TryOnMessageResponse } from "../lib/types";

chrome.runtime.onMessage.addListener(
  (message: TryOnMessage, _sender, sendResponse: (response: TryOnMessageResponse) => void) => {
    if (message.type !== "TRY_ON") {
      return false;
    }

    void (async () => {
      try {
        const settings = await getSettings();
        if (!settings.userImageB64) {
          sendResponse({ ok: false, error: "Upload a photo in the extension popup first." });
          return;
        }

        const data = await requestTryOn(settings.backendUrl, settings.userImageB64, message.payload);
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown try-on error",
        });
      }
    })();

    return true;
  },
);

