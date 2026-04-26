import { describe, it, expect, vi, beforeEach } from "vitest";
import { SelectTool } from "@/core/tools/SelectTool";
import { createMockToolContext } from "../../mocks";

describe("Selection and Transform Tools", () => {
  let context: any;

  beforeEach(() => {
    context = createMockToolContext();
  });

  describe("SelectTool", () => {
    it("should create a rectangle selection", () => {
      const tool = new SelectTool();
      tool.onMouseDown({ button: 0, offsetX: 50, offsetY: 50 } as MouseEvent, context);
      context.screenToProject = vi.fn(() => ({ x: 150, y: 150 }));
      tool.onMouseMove({ offsetX: 150, offsetY: 150 } as MouseEvent, context);
      tool.onMouseUp({ offsetX: 150, offsetY: 150 } as MouseEvent, context);

      expect(context.updateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          selection: expect.objectContaining({
            hasSelection: true,
            bounds: { x: 50, y: 50, width: 100, height: 100 },
          }),
        }),
      );
    });
  });
});
