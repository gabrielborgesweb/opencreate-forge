// renderer/engineDrawing.js

/** Desenha um "dab" (círculo) de pincel suave */
export function drawDab(context, ctx, x, y, radius, hardness, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const innerStop = Math.max(0, Math.min(1, hardness));

  let opaque, mid, transparent;

  if (ctx.globalCompositeOperation === "destination-out") {
    // Para a borracha
    opaque = "rgba(0,0,0,1)";
    transparent = "rgba(0,0,0,0)";
  } else {
    // Para o pincel
    opaque = context.hexToRgba(color, 1);
    transparent = context.hexToRgba(color, 0);
  }

  // --- CORREÇÃO (Parte 1) ---
  // O centro (0) é sempre opaco.
  gradient.addColorStop(0, opaque);

  // O núcleo opaco se estende até 'innerStop'.
  // (Para hardness 0%, innerStop é 0, então este passo não faz nada, o que é correto)
  gradient.addColorStop(innerStop, opaque);

  // O restante (de innerStop até 1.0) é uma queda LINEAR para transparente.
  // Isso cria o "blur" suave da imagem azul, em vez do "hotspot" da imagem vermelha.
  gradient.addColorStop(1, transparent);
  // --- FIM DA CORREÇÃO ---

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Desenha um segmento do traço (pincel ou lápis) */
export function drawBrushStroke(context, x, y) {
  const {
    isDrawing,
    strokeCanvas,
    tools,
    activeToolId,
    strokeOriginX,
    strokeOriginY,
    lastX,
    lastY,
  } = context;

  if (!isDrawing || !strokeCanvas) return;

  const ctx = strokeCanvas.getContext("2d");
  const toolOptions = tools[activeToolId];

  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");

  if (activeToolId === "eraserTool") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  const localLastX = lastX - strokeOriginX;
  const localLastY = lastY - strokeOriginY;
  const localX = x - strokeOriginX;
  const localY = y - strokeOriginY;

  if (isPencilMode) {
    ctx.fillStyle = toolOptions.color || "#000000";
    if (activeToolId === "eraserTool") {
      ctx.fillStyle = "#000000";
    }
    const size = toolOptions.size;
    const shape = toolOptions.shape;

    // Algoritmo de linha de Bresenham
    let x0 = Math.floor(localLastX);
    let y0 = Math.floor(localLastY);
    const x1 = Math.floor(localX);
    const y1 = Math.floor(localY);

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      if (shape === "square") {
        ctx.fillRect(
          x0 - Math.floor(size / 2),
          y0 - Math.floor(size / 2),
          size,
          size
        );
      } else {
        // sphere
        if (size % 2 !== 0) {
          const r = (size - 1) / 2;
          for (let dy = -r; dy <= r; dy++) {
            const dx = Math.floor(Math.sqrt(r * r - dy * dy));
            ctx.fillRect(x0 - dx, y0 + dy, 2 * dx + 1, 1);
          }
        } else {
          // Lógica de scanline O(N) para tamanhos pares
          const radius = size / 2;
          const topLeftX = x0 - radius;
          const topLeftY = y0 - radius;

          // Iteramos 'size' vezes (O(N)), e não 'size*size'
          for (let y = 0; y < size; y++) {
            // 1. Encontra a distância y do centro
            const dist_y = y + 0.5 - radius;

            // 2. Calcula o 'dx' máximo (largura do scanline) usando a equação do círculo
            const max_dist_x_sq = radius * radius - dist_y * dist_y;

            // Se negativo, a linha está fora do círculo
            if (max_dist_x_sq < 0) continue;

            const max_dist_x = Math.sqrt(max_dist_x_sq);

            // 3. Encontra os pixels x inicial e final para este scanline
            // Resolvemos a equação: -max_dist_x <= x + 0.5 - radius <= max_dist_x
            const x_min = Math.ceil(-max_dist_x + radius - 0.5);
            const x_max = Math.floor(max_dist_x + radius - 0.5);

            // 4. Desenha o scanline de uma só vez
            const draw_width = x_max - x_min + 1;
            if (draw_width > 0) {
              ctx.fillRect(topLeftX + x_min, topLeftY + y, draw_width, 1);
            }
          }
        }
      }

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  } else {
    // Pincel Suave
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;

    if (hardness >= 1.0) {
      // Pincel Duro
      ctx.strokeStyle = toolOptions.color || "#000000";
      if (activeToolId === "eraserTool") {
        ctx.strokeStyle = "#000000";
      }
      ctx.lineWidth = toolOptions.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(localLastX, localLastY);
      ctx.lineTo(localX, localY);
      ctx.stroke();
    } else {
      // Pincel Suave (dabs)
      const size = toolOptions.size;
      const color = toolOptions.color || "#000000";
      const dist = Math.hypot(localX - localLastX, localY - localLastY);
      const angle = Math.atan2(localY - localLastY, localX - localLastX);

      // --- CORREÇÃO (Parte 2) ---
      // (Esta é a correção da nossa conversa anterior, que DEVE ser mantida)

      // O raio é baseado no 'size', não no 'effectiveSize'.
      const radius = size;

      // O espaçamento é baseado no raio real (25% do raio).
      const spacing = Math.max(1, radius * 0.25);

      /* CÓDIGO ANTIGO REMOVIDO:
      const effectiveSize = size * (1 + (1 - hardness) * 0.5);
      const radius = effectiveSize / 2;
      const spacing = Math.max(1, (size / 2) * 0.25);
      */
      // --- FIM DA CORREÇÃO ---

      for (let i = 0; i < dist; i += spacing) {
        const px = localLastX + Math.cos(angle) * i;
        const py = localLastY + Math.sin(angle) * i;
        drawDab(context, ctx, px, py, radius, hardness, color);
      }
      drawDab(context, ctx, localX, localY, radius, hardness, color);
    }
  }

  context.lastX = x;
  context.lastY = y;

  context.draw();
}

/** Chamado no mousedown para iniciar um traço */
export function startDrawing(context, e) {
  const { isTransforming, activeToolId, activeLayer, STROKE_PADDING, tools } =
    context;

  if (isTransforming) return;
  const isDrawableTool =
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool";

  if (e.button !== 0 || !activeLayer || !isDrawableTool) {
    return;
  }

  context.isDrawing = true;

  context.strokeOriginX = activeLayer.x - STROKE_PADDING;
  context.strokeOriginY = activeLayer.y - STROKE_PADDING;
  const strokeWidth = activeLayer.image.width + STROKE_PADDING * 2;
  const strokeHeight = activeLayer.image.height + STROKE_PADDING * 2;

  context.strokeCanvas = document.createElement("canvas");
  context.strokeCanvas.width = strokeWidth;
  context.strokeCanvas.height = strokeHeight;
  const strokeCtx = context.strokeCanvas.getContext("2d");

  const toolOptions = tools[activeToolId];
  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");
  if (isPencilMode) {
    strokeCtx.imageSmoothingEnabled = false;
  }

  strokeCtx.drawImage(activeLayer.image, STROKE_PADDING, STROKE_PADDING);

  const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
  context.lastX = px;
  context.lastY = py;

  let effectiveSize;
  if (isPencilMode) {
    effectiveSize = toolOptions.size;
  } else {
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
    effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  }
  const pad = effectiveSize / 2;
  context.currentStrokeBounds = {
    minX: px - pad,
    minY: py - pad,
    maxX: px + pad,
    maxY: py + pad,
  };

  drawBrushStroke(context, px, py);

  window.addEventListener("mousemove", context.processDrawing);
  window.addEventListener("mouseup", context.stopDrawing, { once: true });
}

/** Chamado no mousemove global durante um traço */
export function processDrawing(context, e) {
  if (!context.isDrawing) return;

  const canvasRect = context.canvas.getBoundingClientRect();
  const canvasX = e.clientX - canvasRect.left;
  const canvasY = e.clientY - canvasRect.top;

  const { x: px, y: py } = context.screenToProject(canvasX, canvasY);
  const {
    lastX,
    lastY,
    MIN_BRUSH_MOVE_DISTANCE,
    tools,
    activeToolId,
    currentStrokeBounds,
  } = context;

  // Precisamos saber se é o modo lápis ANTES da verificação de distância.
  const toolOptions = tools[activeToolId];
  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");

  const dist = Math.hypot(px - lastX, py - lastY);

  // Se NÃO for o modo lápis, aplicamos a otimização de distância.
  // Se FOR o modo lápis, pulamos esta verificação para permitir
  // que o Bresenham atue em cada pixel.
  if (!isPencilMode && dist < MIN_BRUSH_MOVE_DISTANCE) {
    return;
  }

  let effectiveSize;
  if (isPencilMode) {
    effectiveSize = toolOptions.size;
  } else {
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
    effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  }
  const pad = effectiveSize / 2;

  currentStrokeBounds.minX = Math.min(
    currentStrokeBounds.minX,
    px - pad,
    lastX - pad
  );
  currentStrokeBounds.minY = Math.min(
    currentStrokeBounds.minY,
    py - pad,
    lastY - pad
  );
  currentStrokeBounds.maxX = Math.max(
    currentStrokeBounds.maxX,
    px + pad,
    lastX + pad
  );
  currentStrokeBounds.maxY = Math.max(
    currentStrokeBounds.maxY,
    py + pad,
    lastY + pad
  );

  drawBrushStroke(context, px, py);
}

/** Chamado no mouseup global para finalizar um traço */
export function stopDrawing(context, e) {
  if (!context.isDrawing) return;

  context.isDrawing = false;
  window.removeEventListener("mousemove", context.processDrawing);

  const {
    STROKE_PADDING,
    activeLayer,
    currentStrokeBounds,
    strokeOriginX,
    strokeOriginY,
    strokeCanvas,
  } = context;

  const originalLayerBounds = {
    x: STROKE_PADDING,
    y: STROKE_PADDING,
    width: activeLayer.image.width,
    height: activeLayer.image.height,
  };

  const strokeRelativeBounds = {
    x: currentStrokeBounds.minX - strokeOriginX,
    y: currentStrokeBounds.minY - strokeOriginY,
    width: currentStrokeBounds.maxX - currentStrokeBounds.minX,
    height: currentStrokeBounds.maxY - currentStrokeBounds.minY,
  };

  const searchBounds = {
    x: Math.min(originalLayerBounds.x, strokeRelativeBounds.x),
    y: Math.min(originalLayerBounds.y, strokeRelativeBounds.y),
    width: 0,
    height: 0,
  };
  const right = Math.max(
    originalLayerBounds.x + originalLayerBounds.width,
    strokeRelativeBounds.x + strokeRelativeBounds.width
  );
  const bottom = Math.max(
    originalLayerBounds.y + originalLayerBounds.height,
    strokeRelativeBounds.y + strokeRelativeBounds.height
  );
  searchBounds.width = right - searchBounds.x;
  searchBounds.height = bottom - searchBounds.y;

  const bounds = context.getOptimizedBoundingBox(strokeCanvas, searchBounds);

  context.currentStrokeBounds = null;

  if (bounds) {
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = bounds.width;
    newLayerCanvas.height = bounds.height;
    const newCtx = newLayerCanvas.getContext("2d");
    newCtx.drawImage(
      strokeCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x = strokeOriginX + bounds.x;
      activeLayer.y = strokeOriginY + bounds.y;
      context.strokeCanvas = null;
      context.saveState();
      context.draw();
      if (typeof window.Engine.updateLayersPanel === "function") {
        window.Engine.updateLayersPanel();
      }
    };
    img.src = newLayerCanvas.toDataURL();
  } else {
    // Camada ficou vazia
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x = 0;
      activeLayer.y = 0;
      context.strokeCanvas = null;
      context.saveState();
      context.draw();
      if (typeof window.Engine.updateLayersPanel === "function") {
        window.Engine.updateLayersPanel();
      }
    };
    img.src = emptyCanvas.toDataURL();
  }
}
