import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForgeEngine } from "@/core/engine/ForgeEngine";
import { createMockProject } from "../../mocks";

describe("ForgeEngine", () => {
  let canvas: HTMLCanvasElement;
  let onViewportChange: any;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    Object.defineProperty(canvas, "parentElement", {
      value: { clientWidth: 1000, clientHeight: 800 },
      configurable: true,
      writable: true
    });
    onViewportChange = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("should initialize with tools", () => {
    const engine = new ForgeEngine(canvas, onViewportChange);
    expect(engine).toBeDefined();
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it("should convert screen coordinates to project coordinates", () => {
    const engine = new ForgeEngine(canvas, onViewportChange);
    const project = createMockProject({ zoom: 2, panX: 100, panY: 50 });
    engine.setProject(project);
    const coords = engine.screenToProject(200, 150);
    expect(coords).toEqual({ x: 50, y: 50 });
  });
});
