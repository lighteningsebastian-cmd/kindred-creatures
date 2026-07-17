/**
 * Shrinks an image File so its longest edge is at most maxPx, re-encoding as
 * JPEG to keep the upload small. Runs entirely in the browser via a canvas.
 *
 * Returns the original File untouched when the browser cannot decode it (e.g.
 * HEIC, which most canvases will not draw) so the upload can still proceed and
 * the server handles it.
 */
export async function downscaleImage(
  file: File,
  maxPx = 2048,
): Promise<Blob> {
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);

    if (longest <= maxPx) {
      close(bitmap);
      return file;
    }

    const scale = maxPx / longest;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      close(bitmap);
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    close(bitmap);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return await createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function close(bitmap: ImageBitmap | HTMLImageElement): void {
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
}
