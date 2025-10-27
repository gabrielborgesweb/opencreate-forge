// renderer/engineTransform.js

/** Converte coordenadas do projeto (mundo) para o espaço local (rotacionado/escalado) da camada */
export function worldToLocal(context, px, py) {
  const { transformState } = context;
  if (!transformState) return { x: 0, y: 0 };
  const t = transformState.currentTransform;

  let x = px - t.x;
  let y = py - t.y;

  const rot = (-t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x_rot = x * cos - y * sin;
  let y_rot = x * sin + y * cos;

  return { x: x_rot, y: y_rot };
}

/** Converte coordenadas locais (rotacionadas/escaladas) para o espaço do projeto (mundo) */
export function localToWorld(context, lx, ly) {
  const { transformState } = context;
  if (!transformState) return { x: 0, y: 0 };
  const t = transformState.currentTransform;

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

/** Retorna uma lista de todos os controles de transformação e suas posições */
export function getTransformHandles(context, local = false) {
  const { transformState, TRANSFOM_HANDLE_SIZE_PROJ, scale } = context;
  if (!transformState) return [];
  const t = transformState.currentTransform;

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

/** Encontra qual controle de transformação está em um ponto (coords do projeto) */
export function getHandleAtPoint(context, px, py) {
  const { TRANSFOM_HANDLE_SIZE_PROJ, scale, transformState } = context;
  const handles = getTransformHandles(context, false); // Coords do mundo
  const handleSize = TRANSFOM_HANDLE_SIZE_PROJ / scale;
  const checkRadius = (handleSize / 2) * 1.5;
  const rotation = transformState.currentTransform.rotation;

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
  const t = transformState.currentTransform;
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

/** Entra no modo de transformação */
export function enterTransformMode(context) {
  const { activeLayer, brushPreview } = context;
  if (context.isTransforming || !activeLayer) return;

  console.log("Entrando no modo de transformação:", activeLayer.id);
  context.isTransforming = true;
  context.isSelecting = false;
  context.lastUsedToolId = context.activeToolId;
  context.activeToolId = "transformTool";
  document.body.classList.add("transforming");

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

  context.transformState = {
    originalLayer: {
      ...activeLayer,
      image: activeLayer.image,
    },
    currentTransform: {
      x: activeLayer.x + activeLayer.image.width / 2,
      y: activeLayer.y + activeLayer.image.height / 2,
      width: activeLayer.image.width,
      height: activeLayer.image.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorString: "center-middle",
      anchor: { x: 0.5, y: 0.5 },
    },
    activeHandle: null,
    dragStartCoords: { x: 0, y: 0 },
    dragStartTransform: null,
  };

  context.draw();
}

/** Cancela a transformação e restaura o estado original */
export function cancelTransform(context, isApplying = false) {
  if (!context.isTransforming) return;

  if (!isApplying) {
    const original = context.transformState.originalLayer;
    context.activeLayer.image = original.image;
    context.activeLayer.x = original.x;
    context.activeLayer.y = original.y;
    console.log("Transformação cancelada.");

    // Restaura a seleção, se houver uma salva
    const restoreData = context.selectionRestoreData;
    if (restoreData) {
      context.restoreSelection(restoreData); // A restauração fará o draw()
    }
  }

  context.isTransforming = false;
  context.transformState = null;
  context.activeToolId = context.lastUsedToolId;
  document.body.classList.remove("transforming");

  context.draw();
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
}

/** Aplica a transformação, criando uma nova imagem de camada */
export async function applyTransform(context) {
  if (!context.isTransforming) return;

  // A seleção será invalidada, então limpa o backup
  context.selectionRestoreData = null;

  const { transformState, activeLayer } = context;
  const t = transformState.currentTransform;
  const originalImg = transformState.originalLayer.image;

  const corners = [
    { x: -t.width * t.anchor.x, y: -t.height * t.anchor.y },
    { x: t.width * (1 - t.anchor.x), y: -t.height * t.anchor.y },
    { x: t.width * (1 - t.anchor.x), y: t.height * (1 - t.anchor.y) },
    { x: -t.width * t.anchor.x, y: t.height * (1 - t.anchor.y) },
  ];

  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const transformedCorners = corners.map((c) => {
    const scaledX = c.x * t.scaleX;
    const scaledY = c.y * t.scaleY;
    return {
      x: t.x + (scaledX * cos - scaledY * sin),
      y: t.y + (scaledX * sin + scaledY * cos),
    };
  });

  const minX = Math.min(...transformedCorners.map((c) => c.x));
  const minY = Math.min(...transformedCorners.map((c) => c.y));
  const maxX = Math.max(...transformedCorners.map((c) => c.x));
  const maxY = Math.max(...transformedCorners.map((c) => c.y));

  const newWidth = parseInt(Math.ceil(maxX - minX));
  const newHeight = parseInt(Math.ceil(maxY - minY));
  const newX = parseInt(Math.round(minX));
  const newY = parseInt(Math.round(minY));

  if (newWidth < 1 || newHeight < 1) {
    // A camada desapareceu, remove-a
    context.layers = context.layers.filter((l) => l.id !== activeLayer.id);
    context.setActiveLayer(
      context.layers.length > 0 ? context.layers[0].id : null
    );
  } else {
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = newWidth;
    newLayerCanvas.height = newHeight;
    const newCtx = newLayerCanvas.getContext("2d");

    newCtx.translate(-newX, -newY);
    newCtx.translate(t.x, t.y);
    newCtx.rotate(rot);
    newCtx.scale(t.scaleX, t.scaleY);
    newCtx.drawImage(
      originalImg,
      -t.width * t.anchor.x,
      -t.height * t.anchor.y
    );

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = newLayerCanvas.toDataURL();
    });

    activeLayer.image = img;
    activeLayer.x = newX;
    activeLayer.y = newY;
  }

  console.log("Transformação aplicada.");

  cancelTransform(context, true); // Sai sem reverter
  context.saveState();
  context.draw();
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
  document.body.classList.remove("transforming");
}

/** Atualiza o estado da transformação a partir da UI (inputs numéricos) */
export function setTransformNumeric(context, option, value) {
  if (!context.isTransforming || isNaN(value)) return;
  context.transformState.currentTransform[option] = value;
  context.draw();
}

/** Define um novo ponto de âncora e recalcula a posição X, Y */
export function setTransformAnchor(context, anchorString) {
  if (!context.isTransforming) return;

  const t = context.transformState.currentTransform;
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
  context.notifyTransformUI();
}
