import type { ExtensionSettings } from "./types";

const STORAGE_KEY = "aiTryOnSettings";

const defaults: ExtensionSettings = {
  backendUrl: "http://127.0.0.1:8000",
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...defaults, ...(stored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined) };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...current, ...settings } });
}

export async function clearUserImage(): Promise<void> {
  const current = await getSettings();
  delete current.userImageB64;
  await chrome.storage.local.set({ [STORAGE_KEY]: current });
}

