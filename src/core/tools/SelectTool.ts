import { BaseTool, ToolContext, ToolId } from "./BaseTool";

export class SelectTool extends BaseTool {
  id: ToolId = "select";

  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;

  private isMovingSelection = false;
  private selectionMoveStart = { x: 0, y: 0 };
  private selectionMoveStartBounds = { x: 0, y: 0, width: 0, height: 0 };

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    if (e.button !== 0) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    // O modo já deve estar correto no store graças aos listeners no App.tsx
    // mas capturamos aqui para manter o mesmo modo até o final do clique
    const { mode } = context.settings.select;
    (this as any).effectiveMode = mode;

    // Verificar se clicou dentro da seleção existente para mover
    if (context.project.selection.hasSelection && context.project.selection.bounds) {
      const { bounds } = context.project.selection;
      const canMove = mode === "replace" || mode === "unite";

      if (canMove && this.isPointInSelection(context, x, y)) {
        this.isMovingSelection = true;
        context.setInteracting(true);
        this.selectionMoveStart = { x, y };
        this.selectionMoveStartBounds = { ...bounds };
        return;
      }
    }

    this.isSelecting = true;
    context.setInteracting(true);
    this.startX = Math.floor(x);
    this.startY = Math.floor(y);
    this.currentX = this.startX;
    this.currentY = this.startY;

    if (mode === "replace") {
      this.clearSelection(context);
    }
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    if (this.isMovingSelection) {
      context.canvas.style.cursor = "move";
      const dx = Math.floor(x - this.selectionMoveStart.x);
      const dy = Math.floor(y - this.selectionMoveStart.y);

      const newBounds = {
        ...this.selectionMoveStartBounds,
        x: this.selectionMoveStartBounds.x + dx,
        y: this.selectionMoveStartBounds.y + dy,
      };

      context.updateProject({
        selection: {
          ...context.project.selection,
          bounds: newBounds,
        },
      });
      return;
    }

    if (this.isSelecting) {
      let curX = Math.floor(x);
      let curY = Math.floor(y);

      // Shift: 1:1 ratio
      if (e.shiftKey) {
        const dx = curX - this.startX;
        const dy = curY - this.startY;
        if (Math.abs(dx) > Math.abs(dy)) {
          curY = this.startY + Math.abs(dx) * Math.sign(dy);
        } else {
          curX = this.startX + Math.abs(dy) * Math.sign(dx);
        }
      }

      // Alt: Draw from center
      if (e.altKey) {
        // We redefine start and current to be centered around original start
        // But for rectangle calculation we just need the corners
      }

      this.currentX = curX;
      this.currentY = curY;
      return;
    }

    // Hover logic
    if (context.project.selection.hasSelection && this.isPointInSelection(context, x, y)) {
      context.canvas.style.cursor = "move";
    } else {
      context.canvas.style.cursor = "crosshair";
    }
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    if (this.isMovingSelection) {
      this.isMovingSelection = false;
      context.setInteracting(false);
      context.updateSelectionEdges();
      return;
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      context.setInteracting(false);

      let startX = this.startX;
      let startY = this.startY;
      const currentX = this.currentX;
      const currentY = this.currentY;

      if (e.altKey) {
        const dx = currentX - startX;
        const dy = currentY - startY;
        startX = this.startX - dx;
        startY = this.startY - dy;
      }

      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width < 1 || height < 1) {
        // Clique simples fora de seleção limpa se mode for replace
        if (context.settings.select.mode === "replace") {
          this.clearSelection(context);
        }
        return;
      }

      this.updateSelectionWithRect(context, { x, y, width, height });
    }
  }

  private isPointInSelection(context: ToolContext, px: number, py: number): boolean {
    const { selection } = context.project;
    if (!selection.hasSelection || !selection.bounds) return false;

    const localX = Math.floor(px - selection.bounds.x);
    const localY = Math.floor(py - selection.bounds.y);

    if (
      localX < 0 ||
      localX >= selection.bounds.width ||
      localY < 0 ||
      localY >= selection.bounds.height
    ) {
      return false;
    }

    const { ctx } = context.getSelectionCanvas();
    const pixelData = ctx.getImageData(localX, localY, 1, 1).data;
    return pixelData[3] > 0;
  }

  private async clearSelection(context: ToolContext) {
    if (context.project.selection.hasSelection) {
      context.pushHistory("Deselect");
    }
    await context.clearSelection();
  }

  private async updateSelectionWithRect(
    context: ToolContext,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    const mode = (this as any).effectiveMode || context.settings.select.mode;

    context.pushHistory("Select");

    // Commit if creating new selection in replace mode
    if (mode === "replace" && context.project.selection.floatingLayer) {
      await context.commitFloatingLayer();
    }

    const { canvas: selCanvas, ctx: selCtx } = context.getSelectionCanvas();
    const { selection } = context.project;

    if (!selection.hasSelection || mode === "replace") {
      // Nova seleção
      selCanvas.width = rect.width;
      selCanvas.height = rect.height;
      selCtx.fillStyle = "white";

      const { shape } = context.settings.select;
      if (shape === "ellipse") {
        selCtx.beginPath();
        selCtx.ellipse(
          rect.width / 2,
          rect.height / 2,
          rect.width / 2,
          rect.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        selCtx.fill();
      } else {
        selCtx.fillRect(0, 0, rect.width, rect.height);
      }

      const mask = selCanvas.toDataURL();
      context.setLastSelectionMask(mask);
      context.updateProject({
        selection: {
          hasSelection: true,
          bounds: rect,
          mask,
        },
      });
    } else {
      // Modificar seleção existente
      const oldBounds = selection.bounds!;
      const newBounds = {
        x: Math.min(oldBounds.x, rect.x),
        y: Math.min(oldBounds.y, rect.y),
        right: Math.max(oldBounds.x + oldBounds.width, rect.x + rect.width),
        bottom: Math.max(oldBounds.y + oldBounds.height, rect.y + rect.height),
      };
      const finalWidth = newBounds.right - newBounds.x;
      const finalHeight = newBounds.bottom - newBounds.y;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;
      const tempCtx = tempCanvas.getContext("2d")!;

      // Desenha a seleção antiga no novo canvas com offset
      const offsetX = oldBounds.x - newBounds.x;
      const offsetY = oldBounds.y - newBounds.y;
      tempCtx.drawImage(selCanvas, offsetX, offsetY);

      // Configura o composite operation para o modo selecionado
      switch (mode) {
        case "unite":
          tempCtx.globalCompositeOperation = "source-over";
          break;
        case "subtract":
          tempCtx.globalCompositeOperation = "destination-out";
          break;
        case "intersect":
          tempCtx.globalCompositeOperation = "destination-in";
          break;
      }

      // Desenha o novo retângulo ou elipse
      const { shape } = context.settings.select;
      tempCtx.fillStyle = "white";
      const rx = rect.x - newBounds.x;
      const ry = rect.y - newBounds.y;
      const rw = rect.width;
      const rh = rect.height;

      if (shape === "ellipse") {
        tempCtx.beginPath();
        tempCtx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        tempCtx.fill();
      } else {
        tempCtx.fillRect(rx, ry, rw, rh);
      }

      // Volta ao normal
      tempCtx.globalCompositeOperation = "source-over";

      // Verifica se ainda tem pixels na seleção
      const imageData = tempCtx.getImageData(0, 0, finalWidth, finalHeight);
      const data = imageData.data;
      let hasSelection = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          hasSelection = true;
          break;
        }
      }

      if (hasSelection) {
        selCanvas.width = finalWidth;
        selCanvas.height = finalHeight;
        selCtx.drawImage(tempCanvas, 0, 0);

        const mask = selCanvas.toDataURL();
        context.setLastSelectionMask(mask);
        context.updateProject({
          selection: {
            hasSelection: true,
            bounds: {
              x: newBounds.x,
              y: newBounds.y,
              width: finalWidth,
              height: finalHeight,
            },
            mask,
          },
        });
      } else {
        this.clearSelection(context);
      }
    }

    context.updateSelectionEdges();
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    if (this.isSelecting) {
      ctx.save();
      ctx.setTransform(
        context.project.zoom,
        0,
        0,
        context.project.zoom,
        context.project.panX,
        context.project.panY,
      );

      const startX = this.startX;
      const startY = this.startY;
      const currentX = this.currentX;
      const currentY = this.currentY;

      // Para o preview, vamos apenas desenhar o retângulo do mouse
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      const { shape } = context.settings.select;

      ctx.beginPath();
      if (shape === "ellipse") {
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, w, h);
      }

      ctx.strokeStyle = "white";
      ctx.lineWidth = 1 / context.project.zoom;
      ctx.stroke();

      ctx.beginPath();
      if (shape === "ellipse") {
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.strokeStyle = "black";
      ctx.setLineDash([4 / context.project.zoom, 4 / context.project.zoom]);
      ctx.stroke();

      ctx.restore();
    }
  }

  onDeactivate(context: ToolContext): void {
    this.isSelecting = false;
    this.isMovingSelection = false;
    context.setInteracting(false);
  }
}
