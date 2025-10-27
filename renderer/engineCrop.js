// renderer/engineCrop.js

// --- Lógica de Manipulação (Copiada/Adaptada de engineTransform.js) ---

/** Converte coordenadas do projeto (mundo) para o espaço local (rotacionado/escalado) do corte */
export function worldToLocal(context, px, py) {
  const { cropState } = context;
  if (!cropState) return { x: 0, y: 0 };
  const t = cropState.currentCrop;

  let x = px - t.x;
  let y = py - t.y;

  const rot = (-t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x_rot = x * cos - y * sin;
  let y_rot = x * sin + y * cos;

  return { x: x_rot, y: y_rot };
}

/** Converte coordenadas locais (rotacionadas/escaladas) do corte para o espaço do projeto (mundo) */
export function localToWorld(context, lx, ly) {
  const { cropState } = context;
  if (!cropState) return { x: 0, y: 0 };
  const t = cropState.currentCrop;

  let x = lx;
  let y = ly;

  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x_rot = x * cos - y * sin;
  let y_rot = x * sin + y * cos;

  let x_trans = x_rot + t.x;
  let y_trans = y_rot + t.y;

  return { x: x_trans, y: y_trans };
}

/** Retorna uma lista de todos os controles de corte e suas posições */
export function getCropHandles(context, local = false) {
  const { cropState, TRANSFOM_HANDLE_SIZE_PROJ, scale } = context;
  if (!cropState) return [];
  const t = cropState.currentCrop;

  const HIDE_THRESHOLD = TRANSFOM_HANDLE_SIZE_PROJ * 4;
  const width_screen = Math.abs(t.width * t.scaleX * scale);
  const height_screen = Math.abs(t.height * t.scaleY * scale);

  const hideVerticalEdges = height_screen < HIDE_THRESHOLD;
  const hideHorizontalEdges = width_screen < HIDE_THRESHOLD;

  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;
  const midX = left + width / 2;
  const midY = top + height / 2;

  const allHandles = [
    { name: "top-left", x: left, y: top, cursor: "nwse-resize" },
    { name: "top-middle", x: midX, y: top, cursor: "ns-resize" },
    { name: "top-right", x: left + width, y: top, cursor: "nesw-resize" },
    { name: "center-left", x: left, y: midY, cursor: "ew-resize" },
    { name: "center-right", x: left + width, y: midY, cursor: "ew-resize" },
    { name: "bottom-left", x: left, y: top + height, cursor: "nesw-resize" },
    { name: "bottom-middle", x: midX, y: top + height, cursor: "ns-resize" },
    {
      name: "bottom-right",
      x: left + width,
      y: top + height,
      cursor: "nwse-resize",
    },
    { name: "rotate", x: midX, y: top - 20 / scale, cursor: "crosshair" },
  ];

  const handles = allHandles.filter((h) => {
    if (h.name === "anchor") return false;
    if (h.name === "top-middle" || h.name === "bottom-middle") {
      return !hideHorizontalEdges;
    }
    if (h.name === "center-left" || h.name === "center-right") {
      return !hideVerticalEdges;
    }
    return true;
  });

  if (local) return handles;

  // Converte para coordenadas do mundo
  return handles.map((h) => {
    const worldPos = localToWorld(context, h.x, h.y);
    return { ...h, ...worldPos };
  });
}

/** Encontra qual controle de corte está em um ponto (coords do projeto) */
export function getHandleAtPoint(context, px, py) {
  const { TRANSFOM_HANDLE_SIZE_PROJ, scale, cropState } = context;
  const handles = getCropHandles(context, false); // Coords do mundo
  const handleSize = TRANSFOM_HANDLE_SIZE_PROJ / scale;
  const checkRadius = (handleSize / 2) * 1.5;
  const rotation = cropState.currentCrop.rotation;

  function getRotatedCursor(handleName, originalCursor, rotation) {
    const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
    if (!originalCursor.endsWith("-resize")) return originalCursor;

    let baseDir = "";
    if (handleName.includes("top")) baseDir += "n";
    else if (handleName.includes("bottom")) baseDir += "s";
    if (handleName.includes("left")) baseDir += "w";
    else if (handleName.includes("right")) baseDir += "e";

    if (baseDir === "wn") baseDir = "nw";
    if (baseDir === "en") baseDir = "ne";
    if (baseDir === "ws") baseDir = "sw";
    if (baseDir === "es") baseDir = "se";

    const index = directions.indexOf(baseDir);
    if (index === -1) return originalCursor;

    const steps = Math.round(rotation / 45);
    const newIndex = (index + steps + directions.length) % directions.length;
    return directions[newIndex] + "-resize";
  }

  handles.forEach((h) => {
    h.cursor = getRotatedCursor(h.name, h.cursor, rotation);
  });

  for (let i = handles.length - 1; i >= 0; i--) {
    const h = handles[i];
    const dist = Math.hypot(px - h.x, py - h.y);
    if (dist <= checkRadius) {
      return h;
    }
  }

  const localPos = worldToLocal(context, px, py);
  const t = cropState.currentCrop;
  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  if (
    localPos.x >= left &&
    localPos.x <= left + width &&
    localPos.y >= top &&
    localPos.y <= top + height
  ) {
    return { name: "move", cursor: "move" };
  }

  return null;
}

// --- Lógica de Input (Copiada/Adaptada de engineInput.js) ---

/** Evento: Mouse Down no Corte */
export function handleCropMouseDown(context, e) {
  const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
  const handle = getHandleAtPoint(context, px, py);

  if (!handle) return;

  context.cropState.activeHandle = handle;

  if (handle.name !== "rotate") {
    context.cropState.dragStartCoords = {
      x: parseInt(px),
      y: parseInt(py),
    };
  } else {
    context.cropState.dragStartCoords = { x: px, y: py };
  }

  context.cropState.dragStartCrop = JSON.parse(
    JSON.stringify(context.cropState.currentCrop)
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

    const oppositeHandle = getCropHandles(context, true).find(
      (h) => h.name === oppositeHandleName
    );
    if (oppositeHandle) {
      context.cropState.scaleAnchor = localToWorld(
        context,
        oppositeHandle.x,
        oppositeHandle.y
      );
    } else {
      context.cropState.scaleAnchor = context.cropState.currentCrop;
    }
  }
}

/** Evento: Mouse Move no Corte */
export function handleCropMouseMove(context, e) {
  const { cropState } = context;
  const { x: raw_px, y: raw_py } = context.screenToProject(
    e.offsetX,
    e.offsetY
  );

  const handle = cropState.activeHandle;

  if (!handle) {
    const hoverHandle = getHandleAtPoint(context, raw_px, raw_py);
    document.body.style.cursor = hoverHandle?.cursor || "default";
    return;
  }

  const t = cropState.currentCrop;
  const startT = cropState.dragStartCrop;

  let px, py;
  if (handle.name === "rotate") {
    px = raw_px;
    py = raw_py;
  } else {
    px = parseInt(raw_px);
    py = parseInt(raw_py);
  }

  const dx = px - cropState.dragStartCoords.x;
  const dy = py - cropState.dragStartCoords.y;

  switch (handle.name) {
    case "move":
    case "anchor":
      t.x = startT.x + dx;
      t.y = startT.y + dy;
      break;

    case "rotate": {
      const startAngle = Math.atan2(
        cropState.dragStartCoords.y - startT.y,
        cropState.dragStartCoords.x - startT.x
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
      if (!cropState.scaleAnchor) break;
      const scaleAnchor = cropState.scaleAnchor;

      // REQUISITO: "Fixed Ratio" ou Shift
      const toolOptions = context.tools.cropTool;
      const keepAspect = e.shiftKey || toolOptions.mode === "Fixed Ratio";

      // --- CORREÇÃO: Usa a proporção do projeto se for 'Free' ---
      const startRatio =
        (startT.width * startT.scaleX) / (startT.height * startT.scaleY);
      const fixedRatio =
        toolOptions.mode === "Fixed Ratio"
          ? toolOptions.ratioW / toolOptions.ratioH
          : startRatio; // <-- MUDADO

      const rot = (startT.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const world_axis_x = { x: cos, y: sin };
      const world_axis_y = { x: -sin, y: cos };

      const vec_start = {
        x: cropState.dragStartCoords.x - scaleAnchor.x,
        y: cropState.dragStartCoords.y - scaleAnchor.y,
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
          // --- CORREÇÃO: Lógica de canto para aspect ratio ---
          // Projeta o vetor atual no eixo do vetor inicial
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
          // --- FIM DA CORREÇÃO ---
        } else if (applyScaleX) {
          // Arrastando borda lateral
          const newW = startT.width * startT.scaleX * scaleFactorX;
          const newH = Math.abs(newW / fixedRatio); // <-- MUDADO
          scaleFactorY = newH / Math.abs(startT.height * startT.scaleY); // <-- MUDADO
          applyScaleY = true;
        } else if (applyScaleY) {
          // Arrastando borda vertical
          const newH = startT.height * startT.scaleY * scaleFactorY;
          const newW = Math.abs(newH * fixedRatio); // <-- MUDADO
          scaleFactorX = newW / Math.abs(startT.width * startT.scaleX); // <-- MUDADO
          applyScaleX = true;
        }
      }

      if (applyScaleX) t.scaleX = startT.scaleX * scaleFactorX;
      if (applyScaleY) t.scaleY = startT.scaleY * scaleFactorY;

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
  context.notifyCropUI();
}

/** Evento: Mouse Up no Corte */
export function handleCropMouseUp(context, e) {
  if (!context.cropState.activeHandle) return;
  context.cropState.activeHandle = null;
  context.cropState.dragStartCrop = null;
}

// --- Lógica de Estado (Copiada/Adaptada de engineTransform.js) ---

/** Entra no modo de corte */
export function enterCropMode(context, initialRect = null) {
  const { projectWidth, projectHeight, brushPreview } = context;
  if (context.isCropping || !projectWidth) return;

  console.log("Entrando no modo de corte");
  context.isCropping = true;
  context.isTransforming = false; // Garante que não está nos dois modos
  context.isSelecting = false;
  context.lastUsedToolId = context.activeToolId;
  context.activeToolId = "cropTool";
  document.body.classList.add("cropping"); // (opcional, para CSS)

  // Salva a seleção atual antes de limpá-la
  if (context.hasSelection) {
    context.selectionRestoreData = {
      bounds: { ...context.selectionBounds },
      dataURL: context.selectionCanvas.toDataURL(),
    };
  } else {
    context.selectionRestoreData = null; // Garante que esteja limpa
  }

  context.clearSelection();
  brushPreview.style.display = "none";

  // --- CORREÇÃO (BUG 2): Não sobrescrever a proporção ---
  if (!initialRect) {
    // Se ativado por clique (sem arrastar) ou por seleção,
    // define a proporção para a do projeto (simplificada).
    const commonDivisor = gcd(context.projectWidth, context.projectHeight);
    context.tools.cropTool.ratioW =
      commonDivisor === 0 ? 1 : context.projectWidth / commonDivisor;
    context.tools.cropTool.ratioH =
      commonDivisor === 0 ? 1 : context.projectHeight / commonDivisor;
  }
  // --- FIM DA CORREÇÃO ---

  // Define a caixa de corte inicial
  const cropSettings = initialRect
    ? {
        x: initialRect.x + initialRect.width / 2,
        y: initialRect.y + initialRect.height / 2,
        width: initialRect.width,
        height: initialRect.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        anchorString: "center-middle",
        anchor: { x: 0.5, y: 0.5 },
      }
    : {
        x: projectWidth / 2,
        y: projectHeight / 2,
        width: projectWidth,
        height: projectHeight,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        anchorString: "center-middle",
        anchor: { x: 0.5, y: 0.5 },
      };

  context.cropState = {
    currentCrop: cropSettings,
    activeHandle: null,
    dragStartCoords: { x: 0, y: 0 },
    dragStartCrop: null,
  };

  context.draw();
}

/** Cancela o corte */
export function cancelCrop(context) {
  if (!context.isCropping) return;

  console.log("Corte cancelado.");
  context.isCropping = false;
  context.cropState = null;
  context.activeToolId = context.lastUsedToolId;
  document.body.classList.remove("cropping");

  // Restaura a seleção, se houver uma salva
  const restoreData = context.selectionRestoreData;
  context.selectionRestoreData = null; // Limpa o backup
  if (restoreData) {
    context.restoreSelection(restoreData); // A função de restauração fará o draw()
  } else {
    context.draw(); // Garante o redesenho se não houver seleção
  }
}

/** Aplica o corte ao projeto (REQUISITO PRINCIPAL) */
export async function applyCrop(context) {
  if (!context.isCropping) return;

  // A seleção será invalidada, então limpa o backup
  context.selectionRestoreData = null;

  const { cropState } = context;
  const t = cropState.currentCrop;

  // 1. Calcula as dimensões locais (relativas ao pivô, já escaladas)
  const localTopLeftX = -t.width * t.anchor.x * t.scaleX;
  const localTopLeftY = -t.height * t.anchor.y * t.scaleY;
  const localWidth = t.width * t.scaleX;
  const localHeight = t.height * t.scaleY;

  // 2. Define as novas dimensões e posição do projeto
  // As novas dimensões são as da própria caixa de corte, não o AABB.
  const newProjectWidth = parseInt(Math.ceil(Math.abs(localWidth)));
  const newProjectHeight = parseInt(Math.ceil(Math.abs(localHeight)));

  // newProjectX/Y é o "offset" (o novo 0,0) no espaço "un-rotated world".
  // A lógica de transformação da camada (mais abaixo) calcula:
  // pos_nova = ( (pos_antiga - pivô_corte) * R_inversa + pivô_corte ) - (newProjectX, newProjectY)
  //
  // Queremos que o ponto (0,0) do novo canvas corresponda ao canto
  // superior-esquerdo da caixa de corte (localTopLeftX, localTopLeftY)
  // no espaço "un-rotated".
  //
  // A transformação da camada calcula:
  // finalX = (rotX + t.x) - newProjectX
  // Onde `rotX` é a coordenada local un-rotated (ex: localTopLeftX).
  //
  // Queremos que finalX = 0 quando rotX = localTopLeftX.
  // 0 = (localTopLeftX + t.x) - newProjectX
  // => newProjectX = localTopLeftX + t.x
  //
  // (Não precisamos arredondar, pois a transformação do canvas aceita floats)
  const newProjectX = localTopLeftX + t.x;
  const newProjectY = localTopLeftY + t.y;

  if (newProjectWidth < 1 || newProjectHeight < 1) {
    console.warn("Área de corte inválida");
    cancelCrop(context);
    return;
  }

  const oldActiveLayerId = context.activeLayer ? context.activeLayer.id : null;
  const deletePixels = context.tools.cropTool.deleteCropped;

  // --- INÍCIO DA LÓGICA DE TRANSFORMAÇÃO DE CAMADA ---

  // Helper para converter canvas para Imagem
  const canvasToImage = (canvas) => {
    return new Promise((resolve) => {
      if (canvas.width < 1 || canvas.height < 1) {
        // Cria imagem vazia 1x1 se o canvas for inválido
        const emptyC = document.createElement("canvas");
        emptyC.width = 1;
        emptyC.height = 1;
        canvas = emptyC;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback para uma imagem vazia 1x1 em caso de erro
        const emptyImg = new Image();
        emptyImg.src =
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        resolve(emptyImg);
      };
      img.src = canvas.toDataURL();
    });
  };

  // Imagem vazia 1x1 para camadas totalmente cortadas
  const emptyCanvas = document.createElement("canvas");
  emptyCanvas.width = 1;
  emptyCanvas.height = 1;
  const emptyImage = await canvasToImage(emptyCanvas);

  // Parâmetros da transformação inversa
  const cropRotationRad = (-t.rotation * Math.PI) / 180;
  const invCos = Math.cos(cropRotationRad);
  const invSin = Math.sin(cropRotationRad);

  // Processa cada camada
  const layerPromises = context.layers.map(async (layer) => {
    const img = layer.image;

    // 1. Encontra o bounding box da camada *transformada*
    //    (como em applyTransform)
    const corners = [
      { x: layer.x, y: layer.y },
      { x: layer.x + img.width, y: layer.y },
      { x: layer.x + img.width, y: layer.y + img.height },
      { x: layer.x, y: layer.y + img.height },
    ];

    const transformedCorners = corners.map((c) => {
      // Rotaciona em torno do pivô do corte (t.x, t.y)
      const relX = c.x - t.x;
      const relY = c.y - t.y;
      const rotX = relX * invCos - relY * invSin;
      const rotY = relX * invSin + relY * invCos;
      // Translada para o novo espaço do projeto
      const finalX = rotX + t.x - newProjectX;
      const finalY = rotY + t.y - newProjectY;
      return { x: finalX, y: finalY };
    });

    const layerMinX = Math.min(...transformedCorners.map((c) => c.x));
    const layerMinY = Math.min(...transformedCorners.map((c) => c.y));
    const layerMaxX = Math.max(...transformedCorners.map((c) => c.x));
    const layerMaxY = Math.max(...transformedCorners.map((c) => c.y));

    const newLayerW = parseInt(Math.ceil(layerMaxX - layerMinX));
    const newLayerH = parseInt(Math.ceil(layerMaxY - layerMinY));
    const newLayerX = parseInt(Math.round(layerMinX));
    const newLayerY = parseInt(Math.round(layerMinY));

    if (newLayerW < 1 || newLayerH < 1) {
      return { ...layer, image: emptyImage, x: 0, y: 0 };
    }

    // 2. Cria canvas e desenha a camada transformada
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = newLayerW;
    newLayerCanvas.height = newLayerH;
    const newCtx = newLayerCanvas.getContext("2d");

    // Aplica a transformação (inversa da inversa) para desenhar
    newCtx.translate(-newLayerX, -newLayerY); // Move para o (0,0) do canvas
    newCtx.translate(-newProjectX, -newProjectY); // Move para o (0,0) do *antigo* projeto
    newCtx.translate(t.x, t.y); // Move para o pivô
    newCtx.rotate(cropRotationRad); // Rotaciona
    newCtx.translate(-t.x, -t.y); // Move de volta do pivô

    if (layer.visible) {
      newCtx.drawImage(layer.image, layer.x, layer.y);
    }

    // 3. Lida com deletePixels
    if (!deletePixels) {
      // Não destrutivo: usa a imagem como está
      const newImage = await canvasToImage(newLayerCanvas);
      return { ...layer, image: newImage, x: newLayerX, y: newLayerY };
    } else {
      // Destrutivo: Corta a imagem contra os limites do projeto
      const clippedCanvas = document.createElement("canvas");
      clippedCanvas.width = newLayerW;
      clippedCanvas.height = newLayerH;
      const clippedCtx = clippedCanvas.getContext("2d");

      // Define a área de corte (os limites do projeto) no espaço local da camada
      const clipX = 0 - newLayerX;
      const clipY = 0 - newLayerY;
      clippedCtx.beginPath();
      clippedCtx.rect(clipX, clipY, newProjectWidth, newProjectHeight);
      clippedCtx.clip();

      // Desenha a imagem transformada (que será cortada)
      clippedCtx.drawImage(newLayerCanvas, 0, 0);

      // 4. Otimiza o bounding box (como em engineDrawing)
      const searchBounds = { x: 0, y: 0, width: newLayerW, height: newLayerH };
      const finalBounds = context.getOptimizedBoundingBox(
        clippedCanvas,
        searchBounds
      );

      if (!finalBounds) {
        // Camada inteiramente fora dos limites
        return { ...layer, image: emptyImage, x: 0, y: 0 };
      }

      // 5. Cria a imagem final, otimizada
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = finalBounds.width;
      finalCanvas.height = finalBounds.height;
      const finalCtx = finalCanvas.getContext("2d");

      finalCtx.drawImage(
        clippedCanvas,
        finalBounds.x,
        finalBounds.y,
        finalBounds.width,
        finalBounds.height,
        0,
        0,
        finalBounds.width,
        finalBounds.height
      );

      const finalImage = await canvasToImage(finalCanvas);
      return {
        ...layer,
        image: finalImage,
        x: newLayerX + finalBounds.x,
        y: newLayerY + finalBounds.y,
      };
    }
  });
  // --- FIM DA LÓGICA DE TRANSFORMAÇÃO ---

  // Espera todas as camadas serem processadas
  const processedLayers = await Promise.all(layerPromises);

  // 5. Atualiza o estado do contexto
  context.projectWidth = newProjectWidth;
  context.projectHeight = newProjectHeight;
  context.layers = processedLayers; // Usa a nova lista de camadas

  // Restaura a camada ativa
  if (oldActiveLayerId) {
    context.activeLayer =
      processedLayers.find((l) => l.id === oldActiveLayerId) || null;
  }
  if (!context.activeLayer && processedLayers.length > 0) {
    context.activeLayer = processedLayers[processedLayers.length - 1];
  }

  console.log("Corte aplicado.");

  cancelCrop(context); // Sai do modo de corte
  context.saveState();
  context.fitToScreen(); // Re-centraliza o novo projeto

  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
}

/** Redimensiona a caixa de corte para a proporção da ferramenta */
export function applyCropRatio(context, basedOn = "width") {
  if (!context.isCropping) return;

  const t = context.cropState.currentCrop;
  const toolState = context.tools.cropTool;

  if (toolState.mode !== "Fixed Ratio") return;

  const ratio = toolState.ratioW / toolState.ratioH;
  if (isNaN(ratio) || ratio <= 0) return; // Evita divisão por zero ou proporções inválidas

  // Pega as dimensões visuais atuais
  const currentWidth = t.width * t.scaleX;
  const currentHeight = t.height * t.scaleY;

  if (basedOn === "width") {
    // Mantém a largura, ajusta a altura
    const newHeight = Math.abs(currentWidth / ratio);
    // Preserva a direção (flip)
    const newScaleY = (newHeight / t.height) * Math.sign(t.scaleY || 1);
    t.scaleY = newScaleY;
  } else {
    // Mantém a altura, ajusta a largura
    const newWidth = Math.abs(currentHeight * ratio);
    // Preserva a direção (flip)
    const newScaleX = (newWidth / t.width) * Math.sign(t.scaleX || 1);
    t.scaleX = newScaleX;
  }

  context.draw();
  context.notifyCropUI();
}

/** Atualiza o estado do corte a partir da UI (inputs numéricos) */
export function setCropNumeric(context, option, value) {
  if (!context.isCropping || isNaN(value)) return;
  context.cropState.currentCrop[option] = value;
  context.draw();
  context.notifyCropUI();
}

/** Define um novo ponto de âncora e recalcula a posição X, Y */
export function setCropAnchor(context, anchorString) {
  if (!context.isCropping) return;

  const t = context.cropState.currentCrop;
  const oldAnchor = t.anchor;
  const newAnchor = { ...oldAnchor };

  if (anchorString.includes("top")) newAnchor.y = 0;
  if (anchorString.includes("center-")) newAnchor.y = 0.5;
  if (anchorString.includes("bottom")) newAnchor.y = 1;
  if (anchorString.includes("left")) newAnchor.x = 0;
  if (anchorString.endsWith("-middle")) newAnchor.x = 0.5;
  if (anchorString === "center") newAnchor.x = 0.5;
  if (anchorString.includes("right")) newAnchor.x = 1;

  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  const dx_local = (newAnchor.x - oldAnchor.x) * width;
  const dy_local = (newAnchor.y - oldAnchor.y) * height;

  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const dx_world = dx_local * cos - dy_local * sin;
  const dy_world = dx_local * sin + dy_local * cos;

  t.x = t.x + dx_world;
  t.y = t.y + dy_world;
  t.anchor = newAnchor;
  t.anchorString = anchorString;

  context.draw();
  context.notifyCropUI();
}
