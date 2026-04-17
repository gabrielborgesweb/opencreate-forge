/**
 * Encontra a caixa delimitadora (bounding box) de pixels não transparentes
 * DENTRO de uma área de busca específica para otimização.
 */
export function getOptimizedBoundingBox(
  canvas: HTMLCanvasElement,
  searchBounds: { x: number; y: number; width: number; height: number }
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { x, y, width, height } = searchBounds;

  const searchX = Math.max(0, Math.floor(x));
  const searchY = Math.max(0, Math.floor(y));
  const searchWidth = Math.min(canvas.width - searchX, Math.ceil(width));
  const searchHeight = Math.min(canvas.height - searchY, Math.ceil(height));

  if (searchWidth <= 0 || searchHeight <= 0) return null;

  const data = ctx.getImageData(searchX, searchY, searchWidth, searchHeight).data;
  let minX = canvas.width,
    minY = canvas.height,
    maxX = -1,
    maxY = -1;
  let foundPixel = false;

  for (let dy = 0; dy < searchHeight; dy++) {
    for (let dx = 0; dx < searchWidth; dx++) {
      const alpha = data[(dy * searchWidth + dx) * 4 + 3];
      if (alpha > 0) {
        const globalX = searchX + dx;
        const globalY = searchY + dy;
        minX = Math.min(minX, globalX);
        minY = Math.min(minY, globalY);
        maxX = Math.max(maxX, globalX);
        maxY = Math.max(maxY, globalY);
        foundPixel = true;
      }
    }
  }

  if (!foundPixel) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
