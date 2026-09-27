/**
 * Redimensiona uma imagem no browser antes do upload (as fotos do iPhone têm
 * vários MB). Devolve um JPEG com o lado maior até `maxSize` píxeis.
 */
export async function resizeImage(file: Blob, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const source = await loadImage(file);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter a imagem"))), "image/jpeg", quality);
  });
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Alguns formatos só funcionam via <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
