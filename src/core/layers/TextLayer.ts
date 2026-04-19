import { Layer } from "@/renderer/store/projectStore";

export class TextLayer {
  public static render(ctx: CanvasRenderingContext2D, layer: Layer) {
    ctx.fillStyle = layer.color || "#ffffff";
    ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
    ctx.fillText(layer.text || "", layer.x, layer.y + (layer.fontSize || 0));
  }
}
