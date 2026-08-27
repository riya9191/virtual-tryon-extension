import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, ImageUp, Trash2 } from "lucide-react";

import { fileToCompressedBase64 } from "../lib/image";
import { clearUserImage, getSettings, saveSettings } from "../lib/storage";
import type { ExtensionSettings } from "../lib/types";
import "./styles.css";

function PopupApp(): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>({ backendUrl: "http://127.0.0.1:8000" });
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function handlePhoto(file: File | undefined): Promise<void> {
    if (!file) return;
    setStatus("Preparing photo...");
    const userImageB64 = await fileToCompressedBase64(file);
    await saveSettings({ userImageB64 });
    setSettings((current) => ({ ...current, userImageB64 }));
    setStatus("Photo saved");
  }

  async function handleBackendUrl(value: string): Promise<void> {
    setSettings((current) => ({ ...current, backendUrl: value }));
    await saveSettings({ backendUrl: value });
  }

  async function deletePhoto(): Promise<void> {
    await clearUserImage();
    setSettings(await getSettings());
    setStatus("Photo removed");
  }

  return (
    <main className="popup">
      <header>
        <h1>AI Virtual Try-On</h1>
        <p>Save one photo, then use Try on me on Amazon product pages.</p>
      </header>

      <label className="field">
        <span>Backend URL</span>
        <input
          value={settings.backendUrl}
          onChange={(event) => void handleBackendUrl(event.target.value)}
          placeholder="http://127.0.0.1:8000"
        />
      </label>

      <section className="photoBox">
        {settings.userImageB64 ? (
          <img src={settings.userImageB64} alt="Saved user upload" />
        ) : (
          <div className="emptyPhoto">
            <ImageUp size={28} />
            <span>No photo saved</span>
          </div>
        )}
      </section>

      <div className="actions">
        <label className="primaryButton">
          <ImageUp size={16} />
          Upload photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
        </label>
        <button className="iconButton" type="button" title="Delete saved photo" onClick={() => void deletePhoto()}>
          <Trash2 size={16} />
        </button>
      </div>

      <footer>
        <Check size={14} />
        <span>{status}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);

