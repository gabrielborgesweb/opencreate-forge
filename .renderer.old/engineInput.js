// renderer/engineInput.js

// Importe Layers para poder criar a camada
import * as Layers from "./engineLayers.js";

const textEditor = document.getElementById("textEditor");

/** Evento: Roda do mouse (Zoom/Pan) */
export function handleWheel(context, e) {
  e.preventDefault();
  const { canvas, ZOOM_SENSITIVITY, ZOOM_SMOOTHING, brushPreview } = context;

  if (e.ctrlKey || e.metaKey) {
    const mx = e.offsetX;
    const my = e.offsetY;
    const wheelDelta = -e.deltaY;
    const normalizedDelta =
      Math.sign(wheelDelta) *
      Math.min(Math.abs(wheelDelta * ZOOM_SENSITIVITY), 0.5);

    const zoomFactor = Math.exp(normalizedDelta);
    context.targetScale = Math.min(
      Math.max(context.scale * zoomFactor, 0.05),
      50
    );

    const scaleChange = (context.targetScale - context.scale) * ZOOM_SMOOTHING;
    const newScale = context.scale + scaleChange;

    context.originX = mx - (mx - context.originX) * (newScale / context.scale);
    context.originY = my - (my - context.originY) * (newScale / context.scale);
    context.scale = newScale;
    context.ctx.imageSmoothingEnabled = context.scale <= 1.0;

    brushPreview.style.display = "none";
    context.draw();

    if (Math.abs(context.targetScale - context.scale) > 0.001) {
      requestAnimationFrame(() => {
        const evt = new WheelEvent("wheel", {
          deltaY: 0,
          ctrlKey: true,
          metaKey: true,
        });
        canvas.dispatchEvent(evt);
      });
    }
  } else {
    context.originX -= e.deltaX;
    context.originY -= e.deltaY;
    context.draw();
  }
}

/** Evento: Mouse Down na Transformação */
export function handleTransformMouseDown(context, e) {
  const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
  const handle = context.getHandleAtPoint(px, py);

  if (!handle) return;

  context.transformState.activeHandle = handle;

  if (handle.name !== "rotate") {
    context.transformState.dragStartCoords = {
      x: parseInt(px),
      y: parseInt(py),
    };
  } else {
    context.transformState.dragStartCoords = { x: px, y: py };
  }

  context.transformState.dragStartTransform = JSON.parse(
    JSON.stringify(context.transformState.currentTransform)
  );

  if (
    handle.name !== "move" &&
    handle.name !== "rotate" &&
    handle.name !== "anchor"
  ) {
    let oppositeHandleName = handle.name;
    if (oppositeHandleName.includes("top")) {
      oppositeHandleName = oppositeHandleName.replace("top", "bottom");
    } else if (oppositeHandleName.includes("bottom")) {
      oppositeHandleName = oppositeHandleName.replace("bottom", "top");
    }
    if (oppositeHandleName.includes("left")) {
      oppositeHandleName = oppositeHandleName.replace("left", "right");
    } else if (oppositeHandleName.includes("right")) {
      oppositeHandleName = oppositeHandleName.replace("right", "left");
    }

    const oppositeHandle = context
      .getTransformHandles(true)
      .find((h) => h.name === oppositeHandleName);
    if (oppositeHandle) {
      context.transformState.scaleAnchor = context.localToWorld(
        oppositeHandle.x,
        oppositeHandle.y
      );
    } else {
      context.transformState.scaleAnchor =
        context.transformState.currentTransform;
    }
  }
}

/** Evento: Mouse Move na Transformação */
export function handleTransformMouseMove(context, e) {
  const { transformState } = context;
  const { x: raw_px, y: raw_py } = context.screenToProject(
    e.offsetX,
    e.offsetY
  );

  const handle = transformState.activeHandle;

  if (!handle) {
    const hoverHandle = context.getHandleAtPoint(raw_px, raw_py);
    document.body.style.cursor = hoverHandle?.cursor || "default";
    return;
  }

  const t = transformState.currentTransform;
  const startT = transformState.dragStartTransform;

  let px, py;
  if (handle.name === "rotate") {
    px = raw_px;
    py = raw_py;
  } else {
    px = parseInt(raw_px);
    py = parseInt(raw_py);
  }

  const dx = px - transformState.dragStartCoords.x;
  const dy = py - transformState.dragStartCoords.y;

  switch (handle.name) {
    case "move":
    case "anchor":
      const targetX = startT.x + dx;
      const targetY = startT.y + dy;
      const rot = (t.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const local_left = -t.width * t.anchor.x * t.scaleX;
      const local_top = -t.height * t.anchor.y * t.scaleY;
      const world_offset_x = local_left * cos - local_top * sin;
      const world_offset_y = local_left * sin + local_top * cos;
      const target_visual_left = targetX + world_offset_x;
      const target_visual_top = targetY + world_offset_y;
      const snapped_visual_left = parseInt(target_visual_left);
      const snapped_visual_top = parseInt(target_visual_top);
      const correction_x = snapped_visual_left - target_visual_left;
      const correction_y = snapped_visual_top - target_visual_top;
      t.x = targetX + correction_x;
      t.y = targetY + correction_y;
      break;

    case "rotate": {
      const startAngle = Math.atan2(
        transformState.dragStartCoords.y - startT.y,
        transformState.dragStartCoords.x - startT.x
      );
      const currentAngle = Math.atan2(py - startT.y, px - startT.x);
      const deltaAngle = currentAngle - startAngle;
      let newRotation = startT.rotation + (deltaAngle * 180) / Math.PI;

      if (e.shiftKey) {
        const snapAngle = 15;
        newRotation = Math.round(newRotation / snapAngle) * snapAngle;
      }
      t.rotation = newRotation % 360;
      break;
    }

    default: {
      // Escala
      if (!transformState.scaleAnchor) break;

      // --- INÍCIO DA MODIFICAÇÃO (ALT KEY) ---
      // O scaleAnchor padrão (definido no mousedown) é o handle oposto.
      // Se Alt estiver pressionado, usamos o centro da transformação como âncora.
      const scaleFromCenter = e.altKey;
      const scaleAnchor = scaleFromCenter
        ? { x: startT.x, y: startT.y } // Usa o centro da transformação (no início do drag)
        : transformState.scaleAnchor; // Usa o handle oposto (definido no mousedown)
      // --- FIM DA MODIFICAÇÃO ---

      const keepAspect = e.shiftKey;

      const rot = (startT.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const world_axis_x = { x: cos, y: sin };
      const world_axis_y = { x: -sin, y: cos };

      const vec_start = {
        x: transformState.dragStartCoords.x - scaleAnchor.x,
        y: transformState.dragStartCoords.y - scaleAnchor.y,
      };
      const vec_current = {
        x: px - scaleAnchor.x,
        y: py - scaleAnchor.y,
      };

      const start_proj_x =
        vec_start.x * world_axis_x.x + vec_start.y * world_axis_x.y;
      const start_proj_y =
        vec_start.x * world_axis_y.x + vec_start.y * world_axis_y.y;
      const current_proj_x =
        vec_current.x * world_axis_x.x + vec_current.y * world_axis_x.y;
      const current_proj_y =
        vec_current.x * world_axis_y.x + vec_current.y * world_axis_y.y;

      let scaleFactorX = start_proj_x === 0 ? 1 : current_proj_x / start_proj_x;
      let scaleFactorY = start_proj_y === 0 ? 1 : current_proj_y / start_proj_y;

      let applyScaleX =
        handle.name.includes("left") || handle.name.includes("right");
      let applyScaleY =
        handle.name.includes("top") || handle.name.includes("bottom");
      const isCorner = applyScaleX && applyScaleY;

      if (keepAspect) {
        if (isCorner) {
          const start_mag = Math.hypot(start_proj_x, start_proj_y);
          if (start_mag > 0) {
            const proj_axis = {
              x: start_proj_x / start_mag,
              y: start_proj_y / start_mag,
            };
            const current_proj =
              current_proj_x * proj_axis.x + current_proj_y * proj_axis.y;
            const globalScaleFactor = current_proj / start_mag;
            scaleFactorX = globalScaleFactor;
            scaleFactorY = globalScaleFactor;
          }
        } else if (applyScaleX) {
          scaleFactorY = scaleFactorX;
          applyScaleY = true;
        } else if (applyScaleY) {
          scaleFactorX = scaleFactorY;
          applyScaleX = true;
        }
      }

      if (applyScaleX) t.scaleX = startT.scaleX * scaleFactorX;
      if (applyScaleY) t.scaleY = startT.scaleY * scaleFactorY;

      // A lógica de reposicionamento abaixo funciona automaticamente
      // com a âncora central. Se a âncora for o centro (startT.x/y),
      // vec_anchor_to_center será {0,0}, e t.x/t.y não serão alterados.
      // Se a âncora for o handle oposto, t.x/t.y serão ajustados
      // para compensar a escala.
      const vec_anchor_to_center = {
        x: startT.x - scaleAnchor.x,
        y: startT.y - scaleAnchor.y,
      };
      const center_proj_x =
        vec_anchor_to_center.x * world_axis_x.x +
        vec_anchor_to_center.y * world_axis_x.y;
      const center_proj_y =
        vec_anchor_to_center.x * world_axis_y.x +
        vec_anchor_to_center.y * world_axis_y.y;
      const new_center_proj_x =
        center_proj_x * (applyScaleX ? scaleFactorX : 1);
      const new_center_proj_y =
        center_proj_y * (applyScaleY ? scaleFactorY : 1);
      const new_world_vec = {
        x:
          new_center_proj_x * world_axis_x.x +
          new_center_proj_y * world_axis_y.x,
        y:
          new_center_proj_x * world_axis_x.y +
          new_center_proj_y * world_axis_y.y,
      };
      t.x = scaleAnchor.x + new_world_vec.x;
      t.y = scaleAnchor.y + new_world_vec.y;
      break;
    }
  }

  context.draw();
  context.notifyTransformUI();
}

/** Evento: Mouse Up na Transformação */
export function handleTransformMouseUp(context, e) {
  if (!context.transformState.activeHandle) return;
  context.transformState.activeHandle = null;
  context.transformState.dragStartTransform = null;
}

/** Evento: Mouse Down Principal */
export function handleMouseDown(context, e) {
  if (context.isTransforming) {
    handleTransformMouseDown(context, e);
    return;
  }

  if (context.isCropping) {
    // A função agora está em engineCrop.js, mas é chamada via context
    context.handleCropMouseDown(context, e);
    return;
  }

  if (e.button === 1) {
    // Pan
    context.isPanning = true;
    context.startX = e.clientX - context.originX;
    context.startY = e.clientY - context.originY;
    e.preventDefault();
    return;
  }

  if (context.activeToolId === "selectTool" && e.button === 0) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const toolOptions = context.tools.selectTool;
    const canMoveSelection =
      toolOptions.mode === "replace" || toolOptions.mode === "unite";

    if (
      context.hasSelection &&
      canMoveSelection &&
      context.isPointInSelection(px, py)
    ) {
      context.isMovingSelection = true;
      context.selectionMoveStart = { x: px, y: py };
      context.selectionMoveStartBounds = { ...context.selectionBounds };
      return;
    }

    context.isSelecting = true;
    context.selectionStartX = parseInt(px);
    context.selectionStartY = parseInt(py);

    if (toolOptions.mode === "replace" && !context.isMovingSelection) {
      context.clearSelection();
    }
    return;
  }

  if (context.activeToolId === "cropTool" && e.button === 0) {
    // Ferramenta de corte está ativa, mas não estamos em "modo de corte"
    // Inicia o "arraste" para definir a área de corte
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    context.isSelecting = true; // Reutiliza o estado de 'isSelecting' para desenhar o retângulo
    context.selectionStartX = parseInt(px);
    context.selectionStartY = parseInt(py);
    context.newSelectionRect = null; // Usará isso para desenhar
    return;
  }

  // Iniciar Desenho
  context.startDrawing(e);

  // Mover Camada
  if (
    document.getElementById("moveTool").hasAttribute("active") &&
    context.activeLayer &&
    e.button === 0
  ) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const { activeLayer } = context;
    if (
      px >= activeLayer.x &&
      px <= activeLayer.x + activeLayer.image.width &&
      py >= activeLayer.y &&
      py <= activeLayer.y + activeLayer.image.height
    ) {
      context.draggingLayerState.isDragging = true;
      context.draggingLayerState.offsetX = px - activeLayer.x;
      context.draggingLayerState.offsetY = py - activeLayer.y;
    }
  }

  // --- LÓGICA DA FERRAMENTA DE TEXTO ---
  if (context.activeToolId === "typeTool") {
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    // Se já estiver editando...
    if (context.isTextEditing && context.editingLayerId) {
      const editingLayer = context.layers.find(l => l.id === context.editingLayerId);
      
      // Verifica se o clique foi DENTRO da caixa da camada sendo editada
      // (Hit test simplificado, mas suficiente para saber se o usuário quer mover o cursor ou sair)
      if (editingLayer) {
        // Recalcula bounding box apenas para garantir
        const fSize = editingLayer.fontSize || 24;
        const lines = (editingLayer.text || "").split("\n");
        const height = Math.max(fSize * 1.2 * lines.length, fSize);
        // A largura (width) já deve estar atualizada no layer object pelo oninput
        
        // Verifica bounding box
        if (x >= editingLayer.x && x <= editingLayer.x + editingLayer.width &&
            y >= editingLayer.y && y <= editingLayer.y + height) {
          
          // --- CALCULAR POSIÇÃO DO CURSOR ---
          const tempCtx = document.createElement("canvas").getContext("2d");
          tempCtx.font = `${fSize}px ${editingLayer.fontFamily || "system-ui"}`;
          
          const lineHeight = fSize * 1.2;
          // 1. Descobrir a linha
          let lineIndex = Math.floor((y - editingLayer.y) / lineHeight);
          if (lineIndex < 0) lineIndex = 0;
          if (lineIndex >= lines.length) lineIndex = lines.length - 1;
          
          const lineText = lines[lineIndex];
          const lineWidth = tempCtx.measureText(lineText).width;
          
          // 2. Descobrir X inicial da linha com base no alinhamento
          let lineStartX = editingLayer.x;
          if (editingLayer.align === "center") {
            lineStartX = editingLayer.x + (editingLayer.width / 2) - (lineWidth / 2);
          } else if (editingLayer.align === "right") {
            lineStartX = editingLayer.x + editingLayer.width - lineWidth;
          }
          
          // 3. Descobrir índice do caractere mais próximo
          let closestCharIndex = 0;
          let minDiff = Infinity;
          
          for (let i = 0; i <= lineText.length; i++) {
            const subStr = lineText.substring(0, i);
            const w = tempCtx.measureText(subStr).width;
            const charX = lineStartX + w;
            const diff = Math.abs(x - charX);
            if (diff < minDiff) {
              minDiff = diff;
              closestCharIndex = i;
            }
          }
          
          // 4. Converter para índice global no textarea
          let globalIndex = 0;
          for (let i = 0; i < lineIndex; i++) {
            globalIndex += lines[i].length + 1; // +1 do \n
          }
          globalIndex += closestCharIndex;
          
          // Atualiza o textarea e força redesenho
          textEditor.setSelectionRange(globalIndex, globalIndex);
          // Previne que o textarea perca foco (já que clicamos no canvas)
          setTimeout(() => textEditor.focus(), 0);
          context.draw();
          return; // Consumiu o evento, não commita nem cria nova camada
        }
      }
      
      // Se clicou FORA, commita a edição atual
      commitTextEdit(context);
    }

    // 1. Tentar clicar em uma camada de texto existente para editar (nova edição)
    const clickedLayer = context.layers
      .slice()
      .reverse()
      .find((l) => {
        if (!l.visible || l.type !== "text") return false;

        const tempCtx = document.createElement("canvas").getContext("2d");
        const fSize = l.fontSize || 24;
        const fFamily = l.fontFamily || "system-ui";
        tempCtx.font = `${fSize}px ${fFamily}`;

        const lines = (l.text || "").split("\n");
        let maxWidth = 0;
        lines.forEach((line) => {
          const m = tempCtx.measureText(line);
          if (m.width > maxWidth) maxWidth = m.width;
        });

        const width = Math.max(maxWidth, 20);
        const height = Math.max(fSize * 1.2 * lines.length, fSize);

        // Atualiza dimensões reais no objeto se precisar
        l.width = Math.ceil(width);
        l.height = Math.ceil(height);

        return x >= l.x && x <= l.x + width && y >= l.y && y <= l.y + height;
      });

    if (clickedLayer) {
      context.setActiveLayer(clickedLayer.id);
      startTextEditing(context, clickedLayer);
      if (typeof window.updateTypeToolOptions === "function") {
        window.updateTypeToolOptions();
      }
    } else {
      // 2. Criar nova camada de texto onde clicou
      const newLayer = Layers.addTextLayer(context, "", x, y);
      startTextEditing(context, newLayer);
      if (typeof window.updateTypeToolOptions === "function") {
        window.updateTypeToolOptions();
      }
    }
    return;
  }
}

/** Evento: Mouse Move Principal */
export function handleMouseMove(context, e) {
  if (context.isTransforming) {
    handleTransformMouseMove(context, e);
    context.draw();
    return;
  }

  if (context.isCropping) {
    context.handleCropMouseMove(context, e);
    context.draw();
    return;
  }

  if (context.isPanning) {
    context.originX = e.clientX - context.startX;
    context.originY = e.clientY - context.startY;
    context.draw();
    return;
  }

  if (context.isMovingSelection) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const dx = parseInt(px - context.selectionMoveStart.x);
    const dy = parseInt(py - context.selectionMoveStart.y);
    context.selectionBounds.x = context.selectionMoveStartBounds.x + dx;
    context.selectionBounds.y = context.selectionMoveStartBounds.y + dy;
    context.draw();
    return;
  }

  if (context.isSelecting) {
    // Esta lógica agora serve tanto para 'selectTool' quanto para 'cropTool'
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);

    // Armazena a posição original do mouse
    const originalCurrentX = parseInt(px);
    const originalCurrentY = parseInt(py);

    // Define os pontos de início e fim para o cálculo do retângulo
    // Estes podem ser modificados pelos modificadores (Shift/Alt)
    let startX = context.selectionStartX;
    let startY = context.selectionStartY;
    let currentX = originalCurrentX;
    let currentY = originalCurrentY;

    if (context.activeToolId === "selectTool") {
      // --- INÍCIO DA NOVA LÓGICA (Select Tool: Shift/Alt) ---

      // 1. Modificador Shift (Proporção 1:1)
      if (e.shiftKey) {
        const dx = currentX - startX;
        const dy = currentY - startY;

        // Trava a proporção 1:1 baseada no maior delta (em magnitude)
        if (Math.abs(dx) > Math.abs(dy)) {
          currentY = startY + Math.abs(dx) * Math.sign(dy);
        } else {
          currentX = startX + Math.abs(dy) * Math.sign(dx);
        }
      }

      // 2. Modificador Alt (Desenhar do centro)
      // Isso é calculado *depois* do Shift, para que possam ser combinados
      if (e.altKey) {
        const dx = currentX - startX; // Delta (possivelmente corrigido pelo Shift)
        const dy = currentY - startY; // Delta (possivelmente corrigido pelo Shift)

        // O ponto inicial (clique) vira o centro
        // O novo startX/Y é espelhado
        startX = context.selectionStartX - dx;
        startY = context.selectionStartY - dy;
        // O novo currentX/Y é o ponto original + delta
        currentX = context.selectionStartX + dx;
        currentY = context.selectionStartY + dy;
      }
      // --- FIM DA NOVA LÓGICA ---
    } else if (context.activeToolId === "cropTool") {
      // --- LÓGICA EXISTENTE (BUG 1) ---
      // Nota: A lógica do Crop Tool usa as coordenadas originais do mouse
      // Reseta currentY para o original, pois a lógica do Shift (acima) pode tê-lo modificado
      currentY = originalCurrentY;

      const toolState = context.tools.cropTool;
      if (toolState.mode === "Fixed Ratio") {
        // Usa as coordenadas *originais* do mouse para o cálculo do crop
        const dx = originalCurrentX - context.selectionStartX;
        const dy_original = originalCurrentY - context.selectionStartY;
        const ratio = toolState.ratioW / toolState.ratioH;

        if (ratio > 0 && dx !== 0) {
          // Evita divisão por zero e mantém 0,0
          const constrainedHeight = Math.abs(dx) / ratio;
          // Arredonda o Y para o pixel mais próximo
          // Atualiza 'currentY' que será usado no cálculo final do retângulo
          currentY = parseInt(
            context.selectionStartY +
              constrainedHeight * Math.sign(dy_original || 1) // (|| 1) para evitar Math.sign(0)
          );
        } else if (dx === 0) {
          currentY = context.selectionStartY; // Trava o Y se o X for 0
        }
      }
      // --- FIM DA LÓGICA EXISTENTE ---
    }

    // Cálculo final do retângulo (agora usa startX/Y e currentX/Y modificados)
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    context.newSelectionRect = { x, y, width, height };
    context.draw();
    return;
  }

  if (context.draggingLayerState.isDragging && context.activeLayer) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    context.activeLayer.x = parseInt(px - context.draggingLayerState.offsetX);
    context.activeLayer.y = parseInt(py - context.draggingLayerState.offsetY);
    context.draw();
    return;
  }
}

/** Evento: Mouse Up Principal */
export function handleMouseUp(context, e) {
  if (context.isTransforming) {
    handleTransformMouseUp(context, e);
    return;
  }

  if (context.isCropping) {
    context.handleCropMouseUp(context, e);
    return;
  }

  if (e.button === 1) {
    context.isPanning = false;
  }

  if (context.isMovingSelection) {
    context.isMovingSelection = false;
    context.selectionMoveStartBounds = null;
    context.saveState();
    return;
  }

  if (context.isSelecting) {
    context.isSelecting = false;
    const finalRect = context.newSelectionRect;
    context.newSelectionRect = null;

    // --- INÍCIO DA CORREÇÃO (RECURSO 2) ---
    if (context.activeToolId === "cropTool") {
      if (!finalRect || finalRect.width < 1 || finalRect.height < 1) {
        // O clique foi inválido ou muito pequeno,
        // entra no modo de corte com a tela cheia (comportamento padrão)
        window.Engine.enterCropMode(null);
      } else {
        // Entra no modo de corte usando o retângulo definido
        window.Engine.enterCropMode(finalRect);
      }
      // Atualiza a UI do app.js para mostrar a barra completa (Apply/Cancel)
      if (typeof window.updateSelectedToolUI === "function") {
        window.updateSelectedToolUI();
      }
      return; // Finaliza
    }
    // --- FIM DA CORREÇÃO ---

    // Lógica existente da 'selectTool'
    if (context.activeToolId === "selectTool") {
      if (!finalRect || finalRect.width < 1 || finalRect.height < 1) {
        if (context.tools.selectTool.mode === "replace") {
          context.clearSelection();
        }
        context.draw();
        return;
      }
      context.updateSelectionWithRect(finalRect, context.tools.selectTool.mode);
    }
  }

  if (context.draggingLayerState.isDragging) {
    context.saveState();
    context.draggingLayerState.isDragging = false;
  }
}

/** Evento: Mouse Leave Principal */
export function handleMouseLeave(context) {
  context.isPanning = false;
  context.draggingLayerState.isDragging = false;
}

/** Evento: Double Click Principal */
export function handleDoubleClick(context, e) {
  if (context.activeToolId === "selectTool") {
    context.selectAll();
  }
}

/** Anexa todos os ouvintes de eventos ao canvas */
export function attachInputListeners(context) {
  const { canvas } = context;

  // Bind 'this' (context) to the event handlers
  const onWheel = handleWheel.bind(null, context);
  const onMouseDown = handleMouseDown.bind(null, context);
  const onMouseMove = handleMouseMove.bind(null, context);
  const onMouseUp = handleMouseUp.bind(null, context);
  const onMouseLeave = handleMouseLeave.bind(null, context);
  const onDoubleClick = handleDoubleClick.bind(null, context);

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("dblclick", onDoubleClick);
}

/** Finaliza a edição atual (esconde o textarea e salva na camada) */
function commitTextEdit(context, cancel = false) {
  if (!context.isTextEditing || !context.editingLayerId) return;

  const layer = context.layers.find((l) => l.id === context.editingLayerId);

  if (layer) {
    if (cancel) {
      // Reverte para o texto original
      layer.text = context.originalTextBeforeEdit || "";
    } else {
      // Salva o texto do editor
      layer.text = textEditor.value;

      if (layer.name.startsWith("Text Layer") || layer.name === "Empty Text") {
        layer.name = layer.text.substring(0, 15) || "Empty Text";
      }
    }

    // Recalcula dimensões
    const tempCtx = document.createElement("canvas").getContext("2d");
    const fSize = layer.fontSize || 24;
    const fFamily = layer.fontFamily || "system-ui";
    tempCtx.font = `${fSize}px ${fFamily}`;

    const lines = (layer.text || "").split("\n");
    let maxW = 0;
    lines.forEach((ln) => {
      const m = tempCtx.measureText(ln);
      if (m.width > maxW) maxW = m.width;
    });
    layer.width = Math.ceil(maxW) || 10;
    layer.height = Math.ceil(fSize * 1.2 * lines.length) || 10;
  }

  // Limpa estado
  textEditor.style.display = "none";
  textEditor.value = "";
  context.editingLayerId = null;
  context.isTextEditing = false;
  context.originalTextBeforeEdit = null;

  if (window.Engine.updateLayersPanel) window.Engine.updateLayersPanel();
  context.saveState();
  context.draw();
}

/** Inicia a edição de uma camada de texto */
function startTextEditing(context, layer) {
  // 1. Configura estado
  context.isTextEditing = true;
  context.editingLayerId = layer.id;
  context.originalTextBeforeEdit = layer.text;

  // 2. Configura o textarea invisível
  textEditor.value = layer.text;
  
  // Não precisamos posicionar o textarea, pois ele está oculto via CSS
  // Mas precisamos garantir que ele esteja "visível" para o DOM focar
  textEditor.style.display = "block";
  textEditor.focus();
  
  // Seleciona todo o texto por padrão ao iniciar a edição
  textEditor.setSelectionRange(0, textEditor.value.length);

  // Sincronização ao vivo
  const handleInput = () => {
    layer.text = textEditor.value;
    // Recalcula dimensões para que o cursor funcione corretamente
    const tempCtx = document.createElement("canvas").getContext("2d");
    const fSize = layer.fontSize || 24;
    const fFamily = layer.fontFamily || "system-ui";
    tempCtx.font = `${fSize}px ${fFamily}`;
    const lines = (layer.text || "").split("\n");
    let maxW = 0;
    lines.forEach((ln) => {
      const m = tempCtx.measureText(ln);
      if (m.width > maxW) maxW = m.width;
    });
    layer.width = Math.ceil(maxW) || 10;
    layer.height = Math.ceil(fSize * 1.2 * lines.length) || 10;
    
    context.draw();
  };

  textEditor.oninput = handleInput;

  // Redesenhar ao mover cursor (keydown/keyup/click/select)
  const handleSelectionChange = () => {
    context.draw();
  };
  
  textEditor.onkeydown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitTextEdit(context);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      commitTextEdit(context, true);
      return;
    }
    // Permite que o evento propague para o textarea atualizar o cursor
    // Mas agendamos um draw logo após
    setTimeout(handleSelectionChange, 0);
    e.stopPropagation();
  };
  
  textEditor.onkeyup = handleSelectionChange;
  textEditor.onmouseup = handleSelectionChange; // Para seleção com mouse no textarea (se fosse visível)

  // Commit ao perder foco
  textEditor.onblur = () => {
    // Pequeno delay para permitir que cliques no canvas não fechem a edição imediatamente
    // se o clique for na mesma camada de texto
    setTimeout(() => {
      if (context.isTextEditing && context.editingLayerId === layer.id && document.activeElement !== textEditor) {
        commitTextEdit(context);
      }
    }, 100);
  };
}
