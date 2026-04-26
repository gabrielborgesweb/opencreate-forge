import { describe, it, expect, vi, beforeEach } from "vitest";
import { MoveTool } from "@/core/tools/MoveTool";
import { createMockToolContext, createMockProject } from "../../mocks";

describe("MoveTool", () => {
  let context: any;

  beforeEach(() => {
    context = createMockToolContext();
  });

  it("should move a layer", () => {
    const tool = new MoveTool();
    const project = createMockProject();
    context.project = project;

    tool.onMouseDown({ button: 0, offsetX: 10, offsetY: 10 } as MouseEvent, context);
    context.screenToProject = vi.fn(() => ({ x: 20, y: 25 }));
    tool.onMouseMove({ offsetX: 20, offsetY: 25 } as MouseEvent, context);

    expect(context.updateProject).toHaveBeenCalledWith(expect.objectContaining({
      layers: expect.arrayContaining([
        expect.objectContaining({ x: 10, y: 15 })
      ])
    }));
  });
});
