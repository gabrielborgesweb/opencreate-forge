import { describe, it, expect } from "vitest";
import { BaseTool, ToolId } from "@/core/tools/BaseTool";

class TestTool extends BaseTool {
  id = "test-tool" as ToolId;
}

describe("BaseTool", () => {
  it("should be instantiable and have an id", () => {
    const tool = new TestTool();
    expect(tool.id).toBe("test-tool");
  });

  it("should have default empty methods", () => {
    const tool = new TestTool();
    expect(() => tool.onMouseDown({} as MouseEvent, {} as any)).not.toThrow();
    expect(() => tool.onMouseMove({} as MouseEvent, {} as any)).not.toThrow();
    expect(() => tool.onMouseUp({} as MouseEvent, {} as any)).not.toThrow();
  });
});
