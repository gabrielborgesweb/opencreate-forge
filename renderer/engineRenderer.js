// renderer/engineRenderer.js

/** Cria ou retorna o padrão de quadriculado (checkerboard) */
export function getCheckerPattern(context) {
  const { ctx } = context;
  if (!context.checkerPattern) {
    const size = 10;
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = size * 2;
    patternCanvas.height = size * 2;
    const pctx = patternCanvas.getContext("2d");

    pctx.fillStyle = "#333";
    pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    pctx.fillStyle = "#444";
    pctx.fillRect(0, 0, size, size);
    pctx.fillRect(size, size, size, size);

    context.checkerPattern = ctx.createPattern(patternCanvas, "repeat");
  }
  return context.checkerPattern;
}

/** Loop de animação para a seleção (marching ants) */
export function animate(context, currentTime) {
  context.animationFrameId = requestAnimationFrame((time) =>
    animate(context, time)
  );

  const elapsed = currentTime - context.lastFrameTime;

  if (elapsed > context.frameInterval) {
    context.lastFrameTime = currentTime - (elapsed % context.frameInterval);
    context.lineDashOffset = (context.lineDashOffset - 1) % 16;
    context.draw();
  }
}

export function startAnimation(context) {
  if (!context.animationFrameId) {
    context.lastFrameTime = performance.now();
    context.animationFrameId = requestAnimationFrame((time) =>
      animate(context, time)
    );
  }
}

export function stopAnimation(context) {
  if (context.animationFrameId) {
    cancelAnimationFrame(context.animationFrameId);
    context.animationFrameId = null;
  }
}

/** Desenha a grade de pixels (quando o zoom é alto) */
export function drawGrid(context) {
  const { projectWidth, projectHeight, scale, ctx, originX, originY } = context;
  const gridSize = 1; // 1px grid

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(128,128,128,0.2)";
  ctx.lineWidth = 1 / scale;

  // Vertical lines
  for (let x = 0; x <= projectWidth; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, projectHeight);
  }

  // Horizontal lines
  for (let y = 0; y <= projectHeight; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(projectWidth, y);
  }

  ctx.stroke();
  ctx.restore();
}

/** Desenha os controles de transformação */
export function drawTransformControls(context) {
  const { transformState, ctx, scale, TRANSFOM_HANDLE_SIZE_PROJ } = context;
  const t = transformState.currentTransform;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);

  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([]);
  ctx.strokeRect(left, top, width, height);

  const handleSize = TRANSFOM_HANDLE_SIZE_PROJ / scale;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;

  // Âncora (Losango)
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.beginPath();
  ctx.moveTo(0, -(handleSize * 1.25) / 1.5);
  ctx.lineTo((handleSize * 1.25) / 1.5, 0);
  ctx.lineTo(0, (handleSize * 1.25) / 1.5);
  ctx.lineTo(-(handleSize * 1.25) / 1.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const handles = context.getTransformHandles(true); // Pede handles locais

  // Controles de escala
  handles.forEach((handle) => {
    if (handle.name === "rotate") return;
    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  });

  // Controle de rotação
  const rotHandle = handles.find((h) => h.name === "rotate");
  if (rotHandle) {
    ctx.beginPath();
    ctx.moveTo(rotHandle.x, rotHandle.y + handleSize / 2);
    ctx.lineTo(rotHandle.x, rotHandle.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rotHandle.x, rotHandle.y, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/** Desenha as hitboxes de Debug para a transformação */
export function drawDebugHitboxes(context) {
  const {
    isTransforming,
    transformState,
    TRANSFOM_HANDLE_SIZE_PROJ,
    scale,
    ctx,
    originX,
    originY,
  } = context;
  if (!isTransforming || !transformState) return;

  const handleSize = TRANSFOM_HANDLE_SIZE_PROJ / scale;
  const debugHitboxSize = handleSize * 1.5;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.fillStyle = "rgba(255, 0, 0, 0.3)";

  const handles = context.getTransformHandles(false); // Coords do Mundo
  handles.forEach((h) => {
    ctx.fillRect(
      h.x - debugHitboxSize / 2,
      h.y - debugHitboxSize / 2,
      debugHitboxSize,
      debugHitboxSize
    );
  });
  ctx.restore();

  ctx.save();
  const t = transformState.currentTransform;
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);

  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
  ctx.fillRect(left, top, width, height);

  ctx.restore();
}

export function updateLayersPanel(context) {
  const { layersList, setActiveLayer, draw, saveState } = context;
  let { layers, activeLayer } = context;

  if (!layersList) {
    console.warn("Layers panel element not found.");
    return;
  }
  layersList.innerHTML = "";

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const div = document.createElement("div");
    div.className = "layer-item";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.padding = "6px";
    div.style.background = layer === activeLayer ? "#555" : "transparent";

    // Visibility toggle
    const visibilityBtn = document.createElement("button");
    visibilityBtn.innerHTML = layer.visible ? "👁" : "👁‍🗨";
    visibilityBtn.style.marginRight = "8px";
    visibilityBtn.onclick = (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      saveState();
      updateLayersPanel(context);
      draw();
    };

    // Layer name
    const name = document.createElement("span");
    name.textContent = layer.name;
    name.style.flex = "1";

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      context.layers = context.layers.filter((l) => l.id !== layer.id);
      if (context.activeLayer === layer) {
        context.activeLayer = context.layers[context.layers.length - 1] || null;
      }
      saveState();
      updateLayersPanel(context);
      draw();
    };

    div.append(visibilityBtn, name, deleteBtn);
    div.onclick = () => setActiveLayer(layer.id);
    layersList.appendChild(div);
  }
}
