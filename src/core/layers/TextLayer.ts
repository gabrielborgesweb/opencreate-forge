import { Layer } from "@/renderer/store/projectStore";

export class TextLayer {
  public static render(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    editingState?: { caretIndex: number; selectionStart?: number; isFocused: boolean },
  ) {
    if (!layer.text && !editingState?.isFocused) return;

    const text = layer.text || "";
    const fontSize = layer.fontSize || 24;
    const fontFamily = layer.fontFamily || "Arial";
    const fontWeight = layer.fontWeight || "normal";
    const color = layer.color || "#000000";
    const textAlign = layer.textAlign || "left";
    const lineHeightMult = layer.lineHeight || 1.2;
    const tracking = layer.tracking || 0;
    const lineHeight = fontSize * lineHeightMult;

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign === "justify" ? "left" : textAlign;
    ctx.textBaseline = "alphabetic";

    const lines = this.layoutText(ctx, layer, text, fontSize, tracking);

    let currentY = layer.y + fontSize;

    ctx.fillStyle = color;
    lines.forEach((line, lineIndex) => {
      let currentX = layer.x;
      if (textAlign === "center") {
        currentX = layer.x + layer.width / 2;
      } else if (textAlign === "right") {
        currentX = layer.x + layer.width;
      }

      // Render line
      this.drawTextLine(ctx, line, currentX, currentY, tracking);

      // Render Caret if editing this line
      if (editingState?.isFocused && editingState.caretIndex !== undefined && editingState.selectionStart === editingState.caretIndex) {
        this.renderCaret(
          ctx,
          line,
          lineIndex,
          lines,
          editingState.caretIndex,
          currentX,
          currentY,
          fontSize,
          lineHeight,
          textAlign,
          tracking,
        );
      }

      currentY += lineHeight;
    });

    // Handle selection rendering (drawn AFTER text for negative effect)
    if (editingState?.isFocused && editingState.selectionStart !== undefined && editingState.selectionStart !== editingState.caretIndex) {
      this.renderSelection(
        ctx,
        lines,
        editingState.selectionStart,
        editingState.caretIndex,
        layer.x,
        layer.y,
        layer.width,
        fontSize,
        lineHeight,
        textAlign,
        tracking
      );
    }

    // Render pivot point during editing
    if (editingState?.isFocused) {
      this.renderPivot(ctx, layer);
    }

    ctx.restore();
  }

  private static renderSelection(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    start: number,
    end: number,
    layerX: number,
    layerY: number,
    layerWidth: number,
    fontSize: number,
    lineHeight: number,
    textAlign: string,
    tracking: number
  ) {
    const selStart = Math.min(start, end);
    const selEnd = Math.max(start, end);
    
    ctx.save();
    // Negative effect: we use 'difference' composition
    // or we can draw a solid color. Photoshop uses a solid blue-ish color often,
    // but the user asked for negative/invert.
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "white"; // Difference with white inverts colors

    let charsProcessed = 0;
    lines.forEach((line, lineIndex) => {
      const lineStart = charsProcessed;
      const lineEnd = charsProcessed + line.length;
      
      const intersectionStart = Math.max(selStart, lineStart);
      const intersectionEnd = Math.min(selEnd, lineEnd);

      if (intersectionStart < intersectionEnd) {
        const textBefore = line.substring(0, intersectionStart - lineStart);
        const textSelected = line.substring(intersectionStart - lineStart, intersectionEnd - lineStart);
        
        const offset = this.measureTextWithTracking(ctx, textBefore, tracking);
        const width = this.measureTextWithTracking(ctx, textSelected, tracking);
        
        let currentX = layerX;
        if (textAlign === "center") {
          currentX = layerX + layerWidth / 2 - this.measureTextWithTracking(ctx, line, tracking) / 2;
        } else if (textAlign === "right") {
          currentX = layerX + layerWidth - this.measureTextWithTracking(ctx, line, tracking);
        }

        const rectX = currentX + offset;
        const rectY = layerY + (lineIndex * lineHeight);
        
        ctx.fillRect(rectX, rectY, width, lineHeight);
      }

      charsProcessed += line.length + 1; // +1 for newline
    });

    ctx.restore();
  }

  public static getCaretIndexAt(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    x: number,
    y: number
  ): number {
    const text = layer.text || "";
    const fontSize = layer.fontSize || 24;
    const fontFamily = layer.fontFamily || "Arial";
    const fontWeight = layer.fontWeight || "normal";
    const textAlign = layer.textAlign || "left";
    const lineHeightMult = layer.lineHeight || 1.2;
    const tracking = layer.tracking || 0;
    const lineHeight = fontSize * lineHeightMult;

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = textAlign === "justify" ? "left" : textAlign;
    ctx.textBaseline = "alphabetic";

    const lines = this.layoutText(ctx, layer, text, fontSize, tracking);
    
    // Find line index
    const relativeY = y - layer.y;
    let lineIndex = Math.floor(relativeY / lineHeight);
    lineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));

    const line = lines[lineIndex];
    let currentX = layer.x;
    if (textAlign === "center") {
      currentX = layer.x + layer.width / 2 - this.measureTextWithTracking(ctx, line, tracking) / 2;
    } else if (textAlign === "right") {
      currentX = layer.x + layer.width - this.measureTextWithTracking(ctx, line, tracking);
    }

    const relativeX = x - currentX;
    
    // Find char index in line
    let charIndexInLine = 0;
    let bestDist = Math.abs(relativeX);
    
    for (let i = 1; i <= line.length; i++) {
      const width = this.measureTextWithTracking(ctx, line.substring(0, i), tracking);
      const dist = Math.abs(relativeX - width);
      if (dist < bestDist) {
        bestDist = dist;
        charIndexInLine = i;
      } else {
        // Since widths are increasing, we can break once it starts getting worse
        break;
      }
    }

    // Convert to absolute caret index
    let charsBefore = 0;
    for (let i = 0; i < lineIndex; i++) {
      charsBefore += lines[i].length + 1;
    }

    ctx.restore();
    return charsBefore + charIndexInLine;
  }

  private static renderPivot(ctx: CanvasRenderingContext2D, layer: Layer) {
    const size = 6;
    // We need the zoom to keep the pivot size constant on screen, 
    // but render() doesn't receive it directly. 
    // However, the ctx transform already has zoom applied.
    // To keep it 6px on screen:
    const matrix = ctx.getTransform();
    const zoom = matrix.a; 
    const s = size / zoom;

    ctx.save();
    ctx.fillStyle = layer.color || "#000000";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1 / zoom;
    
    // Position depends on alignment
    let px = layer.x;
    if (layer.textAlign === "center") px = layer.x + layer.width / 2;
    else if (layer.textAlign === "right") px = layer.x + layer.width;

    const py = layer.y + (layer.fontSize || 24); // Baseline of the first line
    
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
    ctx.strokeRect(px - s / 2, py - s / 2, s, s);
    ctx.restore();
  }

  private static layoutText(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    text: string,
    fontSize: number,
    tracking: number,
  ): string[] {
    const rawLines = text.split("\n");
    if (layer.textType === "point") return rawLines;

    const wrappedLines: string[] = [];
    const maxWidth = layer.width;

    rawLines.forEach((rawLine) => {
      const words = rawLine.split(" ");
      let currentLine = "";

      words.forEach((word) => {
        const testLine = currentLine ? currentLine + " " + word : word;
        const metrics = this.measureTextWithTracking(ctx, testLine, tracking);
        if (metrics > maxWidth && currentLine !== "") {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      wrappedLines.push(currentLine);
    });

    return wrappedLines;
  }

  private static drawTextLine(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    tracking: number,
  ) {
    if (tracking === 0) {
      ctx.fillText(text, x, y);
      return;
    }

    let currentX = x;
    if (ctx.textAlign === "center") {
      currentX -= this.measureTextWithTracking(ctx, text, tracking) / 2;
    } else if (ctx.textAlign === "right") {
      currentX -= this.measureTextWithTracking(ctx, text, tracking);
    }

    const prevAlign = ctx.textAlign;
    ctx.textAlign = "left";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      ctx.fillText(char, currentX, y);
      currentX += ctx.measureText(char).width + tracking;
    }
    ctx.textAlign = prevAlign;
  }

  public static measureTextWithTracking(
    ctx: CanvasRenderingContext2D,
    text: string,
    tracking: number,
  ): number {
    if (tracking === 0) return ctx.measureText(text).width;
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      width += ctx.measureText(text[i]).width + tracking;
    }
    return width > 0 ? width - tracking : 0;
  }

  private static renderCaret(
    ctx: CanvasRenderingContext2D,
    lineText: string,
    lineIndex: number,
    allLines: string[],
    caretIndex: number,
    lineX: number,
    lineY: number,
    fontSize: number,
    lineHeight: number,
    textAlign: string,
    tracking: number,
  ) {
    // Determine if caret is in this line
    let charsBeforeLine = 0;
    for (let i = 0; i < lineIndex; i++) {
      charsBeforeLine += allLines[i].length + 1; // +1 for newline
    }

    const relativeCaretIndex = caretIndex - charsBeforeLine;

    if (relativeCaretIndex >= 0 && relativeCaretIndex <= lineText.length) {
      const textBeforeCaret = lineText.substring(0, relativeCaretIndex);
      const offset = this.measureTextWithTracking(ctx, textBeforeCaret, tracking);

      let caretX = lineX + offset;
      if (textAlign === "center") {
        caretX = lineX - this.measureTextWithTracking(ctx, lineText, tracking) / 2 + offset;
      } else if (textAlign === "right") {
        caretX = lineX - this.measureTextWithTracking(ctx, lineText, tracking) + offset;
      }

      ctx.save();
      ctx.globalCompositeOperation = "difference";
      ctx.beginPath();
      ctx.moveTo(caretX, lineY + fontSize * 0.2);
      ctx.lineTo(caretX, lineY - fontSize * 0.8);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.restore();
    }
  }
}
