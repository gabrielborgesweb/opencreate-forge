// renderer/engineRenderer.js

/** Inicia a renomeação de uma camada */
function startRename(e, nameSpan, layer, context) {
  // 'nameSpan' agora é passado diretamente, não pego de e.target

  e.stopPropagation(); // Impede que o clique ative a camada
  const { saveState } = context;

  // console.log("startRename:", nameSpan.parentElement);

  // ***** CORREÇÃO: Removida a linha que usava e.target *****
  // const nameSpan = e.target; // Esta linha falhava (e.target era null)
  // ***** FIM DA CORREÇÃO *****

  const div = nameSpan.parentElement;

  // Substituir o span por um input
  const input = document.createElement("input");
  input.type = "text";
  input.value = layer.name;
  input.className = "layer-rename-input"; // Para estilização

  // Manter o layout
  input.style.flex = "1";

  div.replaceChild(input, nameSpan);
  input.focus();
  input.select();

  const finishRename = () => {
    // console.log("finishRename");

    const newName = input.value.trim();
    if (newName && newName !== layer.name) {
      layer.name = newName;
      saveState();
    }
    // Redesenha o painel de camadas para restaurar o span
    // Usar a API exposta no window.Engine
    window.Engine.updateLayersPanel();
  };

  input.onblur = finishRename;
  input.onkeydown = (ke) => {
    if (ke.key === "Enter") {
      ke.preventDefault();
      input.blur();
    } else if (ke.key === "Escape") {
      ke.preventDefault();
      input.value = layer.name; // Cancela a edição
      input.blur();
    }
  };
}

/** Inicia o arraste */
function handleDragStart(e, layer, context) {
  e.stopPropagation();
  e.dataTransfer.setData("text/plain", layer.id);

  // ***** CORREÇÃO: Reabilitado. Essencial para o drag-drop. *****
  e.dataTransfer.effectAllowed = "move";
  // ***** FIM DA CORREÇÃO *****

  // Usar e.currentTarget para garantir que é o .layer-item
  e.currentTarget.classList.add("dragging");

  // --- INÍCIO DA CORREÇÃO ---
  // Sinaliza ao 'preload.js' (ouvinte global)
  // para ignorar este evento de D&D.
  window.isLayerDragging = true;
  // --- FIM DA CORREÇÃO ---
}

/** No final do arraste (com sucesso ou não), limpa as classes */
function handleDragEnd(e, context) {
  e.stopPropagation();
  // Limpa todas as classes de feedback de arraste de todos os elementos
  document
    .querySelectorAll(".layer-item.dragging")
    .forEach((el) => el.classList.remove("dragging"));
  document
    .querySelectorAll(".layer-item.drag-over-top")
    .forEach((el) => el.classList.remove("drag-over-top"));
  document
    .querySelectorAll(".layer-item.drag-over-bottom")
    .forEach((el) => el.classList.remove("drag-over-bottom"));

  // --- INÍCIO DA CORREÇÃO ---
  // Limpa a flag global.
  window.isLayerDragging = false;
  // --- FIM DA CORREÇÃO ---
}

/** Controla sobre qual item estamos arrastando */
function handleDragOver(e, div) {
  // --- INÍCIO DA CORREÇÃO ---
  // Se não for um arraste de camada (ex: um arquivo), ignore.
  if (!window.isLayerDragging) {
    return;
  }
  // --- FIM DA CORREÇÃO ---

  if (div.classList.contains("dragging")) {
    return;
  }
  // console.log("handleDragOver:", e);

  e.preventDefault(); // Necessário para permitir o drop

  // ***** CORREÇÃO: Reabilitado. Essencial para o drag-drop. *****
  e.dataTransfer.dropEffect = "move";
  // ***** FIM DA CORREÇÃO *****

  // ***** LÓGICA DE UX: Implementando sua sugestão *****
  // Verifica se o mouse está na metade superior ou inferior do item
  const rect = div.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    div.classList.add("drag-over-top");
    div.classList.remove("drag-over-bottom");
  } else {
    div.classList.add("drag-over-bottom");
    div.classList.remove("drag-over-top");
  }
  // ***** FIM DA LÓGICA DE UX *****
}

/** Limpa a classe quando saímos de um item */
function handleDragLeave(e, div) {
  // --- INÍCIO DA CORREÇÃO ---
  // Se não for um arraste de camada (ex: um arquivo), ignore.
  if (!window.isLayerDragging) {
    return;
  }
  // --- FIM DA CORREÇÃO ---

  // console.log("handleDragLeave:", div);
  // Limpa ambos os feedbacks
  div.classList.remove("drag-over-top");
  div.classList.remove("drag-over-bottom");
}

/** Lógica de soltar (drop) */
function handleDrop(e, targetLayer, context) {
  // --- INÍCIO DA CORREÇÃO ---
  // Se não for um arraste de camada (ex: um arquivo), ignore.
  if (!window.isLayerDragging) {
    return;
  }
  // --- FIM DA CORREÇÃO ---

  e.preventDefault();
  // MUITO IMPORTANTE: Impede que o 'drop' borbulhe para o 'body'
  // e acione o D&D de arquivos.
  e.stopPropagation();

  const draggedId = e.dataTransfer.getData("text/plain");
  const targetId = targetLayer.id;

  // Pega o elemento DOM que sofreu o drop
  const dropTargetElement = e.currentTarget;
  const isDropOnTopHalf = dropTargetElement.classList.contains("drag-over-top");

  // Limpa as classes de feedback visual (o handleDragEnd fará o resto)
  dropTargetElement.classList.remove("drag-over-top");
  dropTargetElement.classList.remove("drag-over-bottom");
  handleDragEnd(e, context); // Limpa tudo

  if (draggedId === targetId) {
    return; // Soltou em si mesmo
  }

  const { layers, saveState, draw, setActiveLayer } = context;
  const draggedIndex = layers.findIndex((l) => l.id == draggedId);

  if (draggedIndex === -1) return;

  // Lógica de reordenação
  // 1. Remove o item arrastado
  const [draggedLayer] = layers.splice(draggedIndex, 1);

  // 2. Re-encontra o índice do alvo, pois o array mudou
  // Este é o índice do targetLayer no *novo* array (sem o item arrastado)
  let targetIndex = layers.findIndex((l) => l.id == targetId);

  // 3. Determina onde inserir
  // A lista visual é invertida (índice 0 do array é a camada de baixo)
  // - Soltar na "metade de cima" (visual) significa "antes" (visual).
  // - "Antes" (visual) de um item significa "depois" (no array).
  // - Soltar na "metade de baixo" (visual) significa "depois" (visual).
  // - "Depois" (visual) de um item significa "antes" (no array).

  let insertIndex;
  if (isDropOnTopHalf) {
    // Insere *depois* do alvo no array (visualmente *acima*)
    insertIndex = targetIndex + 1;
  } else {
    // Insere *antes* do alvo no array (visualmente *abaixo*)
    insertIndex = targetIndex;
  }

  layers.splice(insertIndex, 0, draggedLayer);

  saveState();
  window.Engine.updateLayersPanel(); // Usa a API para redesenhar o painel
  draw();

  // Ativa a camada que foi movida
  setActiveLayer(draggedId);
}

/** Cria ou retorna o padrão de quadriculado (checkerboard) */
export function getCheckerPattern(context) {
  const { ctx } = context;
  if (!context.checkerPattern) {
    const size = 8;
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

  // Borda externa
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([]);
  ctx.strokeRect(left, top, width, height);

  // Alça
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

/** ADICIONAR: Desenha os controles de corte */
export function drawCropControls(context) {
  const { cropState, ctx, scale, TRANSFOM_HANDLE_SIZE_PROJ } = context;
  const t = cropState.currentCrop;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);

  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  // Borda externa
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([]);
  ctx.strokeRect(left, top, width, height);

  // --- Guia de Terços ---
  ctx.strokeStyle = "rgba(0, 120, 255, 0.4)";
  ctx.lineWidth = 1 / scale;
  ctx.beginPath();
  // Verticais
  ctx.moveTo(left + width / 3, top);
  ctx.lineTo(left + width / 3, top + height);
  ctx.moveTo(left + (2 * width) / 3, top);
  ctx.lineTo(left + (2 * width) / 3, top + height);
  // Horizontais
  ctx.moveTo(left, top + height / 3);
  ctx.lineTo(left + width, top + height / 3);
  ctx.moveTo(left, top + (2 * height) / 3);
  ctx.lineTo(left + width, top + (2 * height) / 3);
  ctx.stroke();
  // --- Fim da Guia de Terços ---

  // Alça
  const handleSize = TRANSFOM_HANDLE_SIZE_PROJ / scale;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)"; // (Pode trocar para branco se preferir)
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

  const handles = context.getCropHandles(true); // Pede handles locais

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
  console.log("updateLayersPanel");

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
    if (layer === activeLayer) {
      div.classList.add("layer-item-active");
    }
    // div.style.display = "flex";
    // div.style.alignItems = "center";
    // div.style.padding = "6px";
    // div.style.background = layer === activeLayer ? "#555" : "transparent";

    // ***** INÍCIO DA MODIFICAÇÃO: Adicionar Drag & Drop e ID *****
    div.dataset.layerId = layer.id;
    div.draggable = true;

    div.ondragstart = (e) => handleDragStart(e, layer, context);
    div.ondragover = (e) => handleDragOver(e, div);
    div.ondragleave = (e) => handleDragLeave(e, div);

    // ***** CORREÇÃO: Usar 'layer' em vez de 'targetLayer' *****
    div.ondrop = (e) => handleDrop(e, layer, context);
    // ***** FIM DA CORREÇÃO *****

    div.ondragend = (e) => handleDragEnd(e, context);
    // ***** FIM DA MODIFICAÇÃO *****

    // Visibility toggle
    const visibilityBtn = document.createElement("button");
    visibilityBtn.classList.add("visibility-btn");
    visibilityBtn.classList.add(
      layer.visible ? "visibility-btn" : "visibility-btn-hidden"
    );
    visibilityBtn.onclick = (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      saveState();
      updateLayersPanel(context);
      draw();
    };

    // Thumbnail
    const thumbnail = document.createElement("img");
    thumbnail.className = "layer-thumbnail";
    thumbnail.src = layer.image.src;

    // Layer name
    const name = document.createElement("span");
    name.textContent = layer.name;

    // ***** INÍCIO DA CORREÇÃO *****
    // Passar 'name' (o próprio <span>) para startRename,
    // já que 'e.target' não é confiável.
    name.ondblclick = (e) => startRename(e, name, layer, context);
    // ***** FIM DA CORREÇÃO *****

    // Delete button
    // const deleteBtn = document.createElement("button");
    // deleteBtn.innerHTML = "🗑";
    // deleteBtn.onclick = (e) => {
    //   e.stopPropagation();
    //   context.layers = context.layers.filter((l) => l.id !== layer.id);
    //   if (context.activeLayer === layer) {
    //     context.activeLayer = context.layers[context.layers.length - 1] || null;
    //   }
    //   saveState();
    //   updateLayersPanel(context);
    //   draw();
    // };

    div.append(visibilityBtn, thumbnail, name);
    div.onclick = () => {
      if (context.activeLayer.id != layer.id) {
        setActiveLayer(layer.id);
      }
    };

    layersList.appendChild(div);
  }
}
