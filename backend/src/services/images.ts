import sharp from "sharp";

export function decodeBase64Image(input: string, maxImageBytes: number): Buffer {
  const value = input.trim().startsWith("data:") ? input.split(",", 2)[1] : input;
  const bytes = Buffer.from(value, "base64");

  if (!bytes.length || bytes.length > maxImageBytes) {
    throw new Error("user image is missing or too large");
  }

  return bytes;
}

export async function normalizeImage(input: Buffer, maxImageSide: number): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: maxImageSide,
      height: maxImageSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export function encodeBase64Image(input: Buffer): string {
  return input.toString("base64");
}

