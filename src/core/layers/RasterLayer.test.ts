import { describe, it, expect, vi } from "vitest";
import { RasterLayer } from "./RasterLayer";
import { Layer } from "@/renderer/store/projectStore";

describe("RasterLayer", () => {
  it("should draw from canvas cache if available and ready", () => {
    const ctx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const layer = {
      id: "layer1",
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    } as Layer;

    const mockCanvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const layerCanvasCache = new Map([["layer1", mockCanvas]]);
    const layerReadyCache = new Map([["layer1", true]]);
    const imageCache = new Map();
    const onReady = vi.fn();

    RasterLayer.render(ctx, layer, layerCanvasCache, layerReadyCache, imageCache, onReady);

    expect(ctx.drawImage).toHaveBeenCalledWith(mockCanvas, 10, 20);
  });
});
