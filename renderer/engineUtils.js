// renderer/engineUtils.js

// --- Objeto Debug ---
const DebugFlags = {
  transformShowHandles: false,
};

export function DebugGet(key) {
  if (!(key in DebugFlags)) return undefined;
  return DebugFlags[key];
}

export function DebugSet(context, key, value) {
  if (typeof value !== "boolean") return undefined;
  if (!(key in DebugFlags)) return undefined;
  DebugFlags[key] = value;
  context.draw();
  return DebugFlags[key];
}

export function DebugToggle(context, key) {
  if (!(key in DebugFlags)) return undefined;
  DebugFlags[key] = !DebugFlags[key];
  context.draw();
  return DebugFlags[key];
}

/** Gera um ID único simples */
export function uid() {
  return Date.now() + "-" + Math.floor(Math.random() * 10000);
}

/** Notifica app.js para atualizar a UI de transformação */
export function notifyTransformUI() {
  if (typeof window.updateTransformUI === "function") {
    window.updateTransformUI();
  }
}

/** Converte uma string HEX para RGBA */
export function hexToRgba(hex, alpha = 1) {
  if (!hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Encontra a caixa delimitadora (bounding box) de pixels não transparentes
 * DENTRO de uma área de busca específica para otimização.
 */
export function getOptimizedBoundingBox(canvas, searchBounds) {
  const ctx = canvas.getContext("2d");

  const searchX = Math.max(0, Math.floor(searchBounds.x));
  const searchY = Math.max(0, Math.floor(searchBounds.y));
  const searchWidth = Math.min(
    canvas.width - searchX,
    Math.ceil(searchBounds.width)
  );
  const searchHeight = Math.min(
    canvas.height - searchY,
    Math.ceil(searchBounds.height)
  );

  if (searchWidth <= 0 || searchHeight <= 0) {
    return null;
  }

  const data = ctx.getImageData(
    searchX,
    searchY,
    searchWidth,
    searchHeight
  ).data;
  let minX = canvas.width,
    minY = canvas.height,
    maxX = -1,
    maxY = -1;
  let foundPixel = false;

  for (let y = 0; y < searchHeight; y++) {
    for (let x = 0; x < searchWidth; x++) {
      const alpha = data[(y * searchWidth + x) * 4 + 3];
      if (alpha > 0) {
        const globalX = searchX + x;
        const globalY = searchY + y;

        minX = Math.min(minX, globalX);
        minY = Math.min(minY, globalY);
        maxX = Math.max(maxX, globalX);
        maxY = Math.max(maxY, globalY);
        foundPixel = true;
      }
    }
  }

  if (!foundPixel) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Converte coordenadas de evento -> coords do projeto */
export function screenToProject(context, screenX, screenY) {
  const { originX, originY, scale } = context;
  const px = (screenX - originX) / scale;
  const py = (screenY - originY) / scale;
  return { x: px, y: py };
}

/** Converte coordenadas do projeto -> coords de tela */
export function projectToScreen(context, projectX, projectY) {
  const { originX, originY, scale } = context;
  const sx = projectX * scale + originX;
  const sy = projectY * scale + originY;
  return { x: sx, y: sy };
}

/** ATUALIZAR: engineUtils.js não foi fornecido, então adicione esta função de notificação aqui */
export function notifyCropUI(context) {
  if (typeof window.updateCropUI === "function") {
    window.updateCropUI();
  }
}
