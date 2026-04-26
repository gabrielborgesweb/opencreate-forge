import { describe, it, expect, vi } from "vitest";
import { getOptimizedBoundingBox } from "@/core/utils/imageUtils";

describe("imageUtils", () => {
  describe("getOptimizedBoundingBox", () => {
    it("should find the correct bounding box logic", () => {
      const mockData = new Uint8ClampedArray(100 * 100 * 4);
      const idx = (50 * 100 + 50) * 4;
      mockData[idx + 3] = 255;
      const mockCtx = {
        getImageData: vi.fn(() => ({ data: mockData }))
      } as any;
      const mockCanvas = { width: 100, height: 100, getContext: () => mockCtx } as any;
      const bounds = getOptimizedBoundingBox(mockCanvas, { x: 0, y: 0, width: 100, height: 100 });
      expect(bounds).toEqual({ x: 50, y: 50, width: 1, height: 1 });
    });
  });
});
