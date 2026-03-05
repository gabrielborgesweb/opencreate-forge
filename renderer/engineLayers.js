// renderer/engineLayers.js

/** Adiciona uma camada a partir de uma imagem carregada */
export function addLayer(context, img, name = "Layer") {
  const { projectWidth, projectHeight } = context;
  const lx = Math.round((projectWidth - img.width) / 2);
  const ly = Math.round((projectHeight - img.height) / 2);

  const newLayer = {
    id: context.uid(),
    type: "raster", // <--- NOVO: Define tipo explícito
    name,
    image: img,
    x: lx,
    y: ly,
    visible: true,
    opacity: 1, // Recomendado ter opacidade
    blendMode: "source-over",
    // Raster layers usam as dimensoes da imagem
    width: img.width,
    height: img.height,
  };

  context.layers.push(newLayer);
  context.setActiveLayer(newLayer.id);
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
  context.saveState();
  context.draw();
}

/** Adiciona uma camada de Texto Vetorial */
export function addTextLayer(context, text, x, y, options = {}) {
  const { tools } = context;

  // Pega as configurações atuais da ferramenta de texto se não passadas
  const toolSettings = options.toolSettings || tools.typeTool || {};

  const newLayer = {
    id: context.uid(),
    type: "text", // IMPORTANTE: Tipo texto
    name: text.substring(0, 20) || "Text Layer",
    text: text,
    x: x,
    y: y,
    visible: true,
    opacity: 1,
    blendMode: "source-over",

    // Propriedades específicas de texto
    color: toolSettings.color || "#000000",
    fontSize: toolSettings.size || 40,
    fontFamily: toolSettings.font || "system-ui",
    align: toolSettings.align || "left", // left, center, right

    // Para cálculos de colisão (hitbox) aproximados
    width: 100,
    height: 50,
  };

  context.layers.push(newLayer);
  context.setActiveLayer(newLayer.id);

  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }

  context.saveState();
  context.draw();

  return newLayer; // Retorna a camada criada para podermos ativar a edição logo em seguida
}

/** Adiciona uma nova camada preenchida com uma cor */
export function addFillLayer(context, color, name = "Fill Layer") {
  const { projectWidth, projectHeight } = context;
  if (!projectWidth || !projectHeight) return;

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = projectWidth;
  fillCanvas.height = projectHeight;
  const fillCtx = fillCanvas.getContext("2d");

  fillCtx.fillStyle = color;
  fillCtx.fillRect(0, 0, projectWidth, projectHeight);

  const img = new Image();
  img.onload = () => {
    const newLayer = {
      id: context.uid(),
      name,
      image: img,
      x: 0,
      y: 0,
      visible: true,
    };
    context.layers.unshift(newLayer); // Adiciona no fundo
    context.setActiveLayer(newLayer.id);
    if (typeof window.Engine.updateLayersPanel === "function") {
      window.Engine.updateLayersPanel();
    }
    context.saveState();
    context.draw();
  };
  img.src = fillCanvas.toDataURL();
}

/** Cria uma nova camada vazia (1x1 transparente) */
export function createEmptyLayer(context, name = "Empty Layer") {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const img = new Image();
  img.onload = () => {
    const newLayer = {
      id: context.uid(),
      name,
      image: img,
      x: 0,
      y: 0,
      visible: true,
    };
    context.layers.push(newLayer);
    context.setActiveLayer(newLayer.id);
    if (typeof window.Engine.updateLayersPanel === "function") {
      window.Engine.updateLayersPanel();
    }
    context.saveState();
    context.draw();
  };
  img.src = canvas.toDataURL();

  console.log("Empty layer created.");
}

/** Carrega uma imagem do disco (via main process) e a adiciona como camada */
export function loadImage(context, filePath) {
  const img = new Image();
  img.onload = () => {
    addLayer(context, img, filePath.split("/").pop());
  };
  img.onerror = () => console.error("Erro ao carregar imagem:", filePath);
  img.src = filePath;
}

/** Define a camada ativa por ID */
export function setActiveLayer(context, id) {
  const layer = context.layers.find((l) => l.id === id);
  context.activeLayer = layer || null;
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
  context.draw();
}
