import type { ProductSnapshot } from "../lib/types";

export function readAmazonProduct(): ProductSnapshot | null {
  const image = findProductImage();
  const title = text("#productTitle") || document.title.replace(/Amazon.*?:/i, "").trim();

  if (!image || !title) {
    return null;
  }

  return {
    productImageUrl: image,
    product: {
      title,
      category: inferCategory(),
      brand: text("#bylineInfo")?.replace(/^Brand:\s*/i, "").trim() || null,
      marketplace: location.hostname.includes("amazon.") ? "amazon" : null,
      page_url: location.href,
    },
  };
}

export function findAmazonInsertionPoint(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("#imageBlock") ||
    document.querySelector<HTMLElement>("#imgTagWrapperId") ||
    document.body
  );
}

function findProductImage(): string | null {
  const landing = document.querySelector<HTMLImageElement>("#landingImage");
  const dynamic = landing?.dataset.aDynamicImage;
  if (dynamic) {
    try {
      const images = Object.keys(JSON.parse(dynamic) as Record<string, unknown>);
      const highRes = images.find((src) => src.startsWith("http"));
      if (highRes) {
        return highRes;
      }
    } catch {
      // Fall through to normal src attributes.
    }
  }

  return (
    landing?.dataset.oldHires ||
    landing?.src ||
    document.querySelector<HTMLImageElement>("#imgTagWrapperId img")?.src ||
    null
  );
}

function inferCategory(): string | null {
  const breadcrumbs = Array.from(
    document.querySelectorAll<HTMLElement>("#wayfinding-breadcrumbs_feature_div a"),
  )
    .map((node) => node.innerText.trim())
    .filter(Boolean);

  const haystack = [...breadcrumbs, text("#productTitle") || ""].join(" ").toLowerCase();
  if (/\b(shirt|t-shirt|top|kurta|blouse)\b/.test(haystack)) return "top";
  if (/\b(dress|gown|saree)\b/.test(haystack)) return "dress";
  if (/\b(jeans|pants|trouser|shorts|skirt)\b/.test(haystack)) return "bottom";
  if (/\b(shoe|sneaker|sandal|heel)\b/.test(haystack)) return "shoes";
  return breadcrumbs.at(-1) || null;
}

function text(selector: string): string | null {
  return document.querySelector<HTMLElement>(selector)?.innerText.trim() || null;
}

