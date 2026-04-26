/**
 * Purpose: Logic for rendering raster layers, including image caching and lazy loading of data URLs into canvases.
 */
import { Layer } from "@/renderer/store/projectStore";

/**
 * Provides static methods for rendering raster (image-based) layers.
 * Manages canvas caching and lazy loading of image data.
 */
export class RasterLayer {
  /**
   * Renders a raster layer to the given context.
   * @param ctx The destination rendering context.
   * @param layer The layer data to render.
   * @param layerCanvasCache Map of cached canvases per layer ID.
   * @param layerReadyCache Map of readiness flags per layer ID.
   * @param imageCache Map of loaded HTMLImageElements per data URL.
   * @param onReady Callback triggered when the image finishes loading and is ready for rendering in the next frame.
   */
  public static render(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    layerCanvasCache: Map<string, HTMLCanvasElement>,
    layerReadyCache: Map<string, boolean>,
    imageCache: Map<string, HTMLImageElement>,
    onReady: () => void,
  ) {
    let lCanvas = layerCanvasCache.get(layer.id);

    // If not in cache and we have data, try to load it
    if (!lCanvas || lCanvas.width !== layer.width || lCanvas.height !== layer.height) {
      if (layer.data) {
        // Check if we are already loading or have an image
        let img = imageCache.get(layer.data);
        if (!img) {
          img = new Image();
          img.src = layer.data;
          imageCache.set(layer.data, img);
          img.onload = () => {
            const cachedCanvas = document.createElement("canvas");
            cachedCanvas.width = layer.width;
            cachedCanvas.height = layer.height;
            const ctx = cachedCanvas.getContext("2d")!;
            ctx.drawImage(img!, 0, 0);
            layerCanvasCache.set(layer.id, cachedCanvas);
            layerReadyCache.set(layer.id, true);
            onReady();
          };
        } else if (img.complete) {
          const cachedCanvas = document.createElement("canvas");
          cachedCanvas.width = layer.width;
          cachedCanvas.height = layer.height;
          const ctx = cachedCanvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          layerCanvasCache.set(layer.id, cachedCanvas);
          layerReadyCache.set(layer.id, true);
          lCanvas = cachedCanvas;
        }
      }
    }

    if (lCanvas && layerReadyCache.get(layer.id)) {
      ctx.drawImage(lCanvas, Math.round(layer.x), Math.round(layer.y));
    }
  }
}
