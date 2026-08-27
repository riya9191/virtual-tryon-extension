import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "AI Virtual Try-On",
  description: "Generate AI-powered virtual try-on previews on Amazon product pages.",
  version: "0.1.0",
  action: {
    default_title: "AI Virtual Try-On",
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.amazon.in/*", "https://www.amazon.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "activeTab"],
  host_permissions: [
    "https://www.amazon.in/*",
    "https://www.amazon.com/*",
    "http://localhost:8000/*",
    "http://127.0.0.1:8000/*",
  ],
};

export default manifest;

