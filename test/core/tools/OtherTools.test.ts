import { describe, it, expect, vi, beforeEach } from "vitest";
import { TextTool } from "@/core/tools/TextTool";
import { CropTool } from "@/core/tools/CropTool";
import { createMockToolContext } from "../../mocks";

describe("Other Tools", () => {
  let context: any;

  beforeEach(() => {
    context = createMockToolContext();
    context.project.layers = []; 
  });

  describe("TextTool", () => {
    it("should initialize correctly", () => {
      const tool = new TextTool();
      tool.onActivate(context);
      expect(document.getElementById("forge-text-input")).toBeDefined();
      tool.onDeactivate(context);
    });
  });

  describe("CropTool", () => {
    it("should update tool settings on drag", () => {
      const tool = new CropTool();
      tool.onActivate(context);
      tool.onMouseDown({ button: 0, offsetX: 0, offsetY: 0 } as MouseEvent, context);
      context.screenToProject = vi.fn(() => ({ x: 50, y: 50 }));
      tool.onMouseMove({ offsetX: 50, offsetY: 50 } as MouseEvent, context);
      expect(context.updateToolSettings).toHaveBeenCalled();
    });
  });
});
