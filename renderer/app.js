// renderer/app.js

// const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnOpenProject = document.getElementById("btnOpenProject");
const btnSaveProject = document.getElementById("btnSaveProject");
// --- INÍCIO DA MODIFICAÇÃO ---
const btnSaveProjectAs = document.getElementById("btnSaveProjectAs");
// --- FIM DA MODIFICAÇÃO ---

const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

// NOVO: Variável para guardar a escolha do usuário para a ferramenta de seleção
let lastUserSelectMode = "replace";

const btnAddEmptyLayer = document.getElementById("btnAddEmptyLayer");
const btnDeleteActiveLayer = document.getElementById("btnDeleteActiveLayer");

const selectedToolDiv = document.getElementById("selectedtool");
// NOVO: Elemento de pré-visualização
const brushPreview = document.getElementById("brushPreview");
const canvasContainer = document.getElementById("canvasContainer");
// NOVO: Elementos da tela inicial
const homeScreen = document.getElementById("homeScreen");
const mainCanvas = document.getElementById("mainCanvas");

// NOVO: Variável para armazenar o último evento do mouse
let lastMouseEvent = null;

const projects = [
  // { id, name, width, height, layers: [...], selection, scale, originX, originY }
];
const projectsTabs = document.getElementById("projectsTabs");
const homeTab = document.getElementById("homeTab");

// --- NOVO: DADOS DOS PRESETS ---
const presetsData = {
  Social: [
    { name: "Facebook Page Cover", w: 1640, h: 664 },
    { name: "Facebook Event Image", w: 1920, h: 1080 },
    { name: "Facebook Group Header", w: 1640, h: 856 },
    { name: "Instagram", w: 1080, h: 1080 },
    { name: "Instagram Story", w: 1080, h: 1920 },
    { name: "Instagram Portrait", w: 1080, h: 1350 },
    { name: "YouTube Thumbnail", w: 1280, h: 720 },
    { name: "YouTube Profile", w: 800, h: 800 },
    { name: "YouTube Cover", w: 2560, h: 1440 },
    { name: "Twitter Profile", w: 400, h: 400 },
    { name: "Twitter Header", w: 1500, h: 500 },
  ],
  Print: [
    { name: "A4", w: 2480, h: 3508 },
    { name: "A5", w: 1748, h: 2480 },
    { name: "Letter", w: 2550, h: 3300 },
  ],
  "2ᴺ": [
    { name: "16x16", w: 16, h: 16 },
    { name: "32x32", w: 32, h: 32 },
    { name: "64x64", w: 64, h: 64 },
    { name: "128x128", w: 128, h: 128 },
    { name: "256x256", w: 256, h: 256 },
    { name: "512x512", w: 512, h: 512 },
    { name: "1024x1024", w: 1024, h: 1024 },
  ],
  // Adicionar mais categorias conforme necessário
};

// NOVO: Adicionar este callback global
// O engine chamará esta função para atualizar os inputs (X, Y, W, H, A)
// enquanto o usuário arrasta os controles.
window.updateTransformUI = () => {
  if (!window.Engine || !window.Engine.isTransforming()) return;

  const state = window.Engine.getTransformState();
  if (!state) return;

  // Garante que os elementos existem antes de tentar definir o valor
  const xInput = document.getElementById("transformPositionXNumber");
  const yInput = document.getElementById("transformPositionYNumber");
  const wInput = document.getElementById("transformSizeWidthNumber");
  const hInput = document.getElementById("transformSizeHeightNumber");
  const aInput = document.getElementById("transformAngleNumber");
  const anchorSelect = document.getElementById("transformAnchorSelect");

  if (xInput) xInput.value = state.x.toFixed(2);
  if (yInput) yInput.value = state.y.toFixed(2);
  if (wInput) wInput.value = (state.scaleX * 100).toFixed(2);
  if (hInput) hInput.value = (state.scaleY * 100).toFixed(2);
  if (aInput) aInput.value = state.rotation.toFixed(2);
  if (anchorSelect) anchorSelect.value = state.anchorString;
};

// NOVO: Adicionar este callback global para o Corte
window.updateCropUI = () => {
  if (!window.Engine || !window.Engine.isCropping()) return;

  const state = window.Engine.getCropState();
  if (!state) return;

  const xInput = document.getElementById("cropPositionXNumber");
  const yInput = document.getElementById("cropPositionYNumber");
  const wInput = document.getElementById("cropSizeWidthNumber");
  const hInput = document.getElementById("cropSizeHeightNumber");
  const aInput = document.getElementById("cropAngleNumber");
  const anchorSelect = document.getElementById("cropAnchorSelect");

  if (xInput) xInput.value = state.x.toFixed(2);
  if (yInput) yInput.value = state.y.toFixed(2);
  if (wInput) wInput.value = (state.scaleX * 100).toFixed(2);
  if (hInput) hInput.value = (state.scaleY * 100).toFixed(2);
  if (aInput) aInput.value = state.rotation.toFixed(2);
  if (anchorSelect) anchorSelect.value = state.anchorString;
};

// --- INÍCIO DA CORREÇÃO (BUG 3) ---
// Adicione esta função em algum lugar no escopo global do app.js
/** Encontra o Maior Divisor Comum para simplificar proporções */
function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  if (b > a) {
    let temp = a;
    a = b;
    b = temp;
  }
  while (true) {
    if (b == 0) return a;
    a %= b;
    if (a == 0) return b;
    b %= a;
  }
}
// --- FIM DA CORREÇÃO (BUG 3) ---

function showTransformUI() {
  const transformState = window.Engine.getTransformState();
  if (!transformState) return;

  // 1. Injeta o HTML da barra de ferramentas de transformação
  selectedToolDiv.innerHTML = `
    <span style="margin-left: 10px; font-weight: 600;">Transform</span>

    <div id="anchor-container" class="numeric-slider">
      <label for="transformAnchorSelect" style="margin-left: 10px">Anchor:</label>
      <select id="transformAnchorSelect" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;">
        <option value="top-left">Top Left</option>
        <option value="top-middle">Top Middle</option>
        <option value="top-right">Top Right</option>
        <option value="center-left">Center Left</option>
        <option value="center-middle">Center</option>
        <option value="center-right">Center Right</option>
        <option value="bottom-left">Bottom Left</option>
        <option value="bottom-middle">Bottom Middle</option>
        <option value="bottom-right">Bottom Right</option>
      </select>
    </div>

    <div id="position-x-container" class="numeric-slider">
      <label for="transformPositionXNumber" style="margin-left: 10px">X:</label>
      <input type="number" step="0.1" id="transformPositionXNumber" class="value-input" style="width: 50px;" />
      <span class="unit">px</span>
    </div>
    <div id="position-y-container" class="numeric-slider">
      <label for="transformPositionYNumber" style="margin-left: 0px">Y:</label>
      <input type="number" step="0.1" id="transformPositionYNumber" class="value-input" style="width: 50px;" />
      <span class="unit">px</span>
    </div>

    <div id="size-w-container" class="numeric-slider">
      <label for="transformSizeWidthNumber" style="margin-left: 10px">W:</label>
      <input type="number" step="0.1" id="transformSizeWidthNumber" class="value-input" style="width: 50px;" />
      <span class="unit">%</span>
    </div>
    <div id="size-h-container" class="numeric-slider">
      <label for="transformSizeHeightNumber" style="margin-left: 0px">H:</label>
      <input type="number" step="0.1" id="transformSizeHeightNumber" class="value-input" style="width: 50px;" />
      <span class="unit">%</span>
    </div>

    <div id="angle-container" class="numeric-slider">
      <label for="transformAngleNumber" style="margin-left: 10px">A:</label>
      <input type="number" step="0.1" id="transformAngleNumber" class="value-input" style="width: 50px;" />
      <span class="unit">deg</span>
    </div>

    <div id="actions-container" style="margin-left: 10px; display: flex; gap: 8px;">
      <button title="Cancel" class="action-button" id="btnCancelTransform">
        <svg-src src="assets/svg/X.svg"></svg-src>
      </button>
      <button title="Apply" class="action-button" id="btnApplyTransform" style="background: var(--accent-color);">
        <svg-src src="assets/svg/Check.svg"></svg-src>
      </button>
    </div>
  `;

  // 2. Popula os valores iniciais
  window.updateTransformUI(); // Usa a função global para preencher os valores

  // 3. Adiciona listeners para os botões e inputs
  const xInput = document.getElementById("transformPositionXNumber");
  const yInput = document.getElementById("transformPositionYNumber");
  const wInput = document.getElementById("transformSizeWidthNumber");
  const hInput = document.getElementById("transformSizeHeightNumber");
  const aInput = document.getElementById("transformAngleNumber");
  const anchorSelect = document.getElementById("transformAnchorSelect");

  // Botões de Ação
  document
    .getElementById("btnCancelTransform")
    .addEventListener("click", () => {
      window.Engine.cancelTransform();
      updateSelectedToolUI(); // Restaura a UI da ferramenta anterior
    });

  document.getElementById("btnApplyTransform").addEventListener("click", () => {
    window.Engine.applyTransform().then(() => {
      updateSelectedToolUI(); // Restaura a UI da ferramenta anterior
    });
  });

  // Inputs Numéricos
  xInput.addEventListener("change", (e) =>
    window.Engine.setTransformNumeric("x", parseFloat(e.target.value))
  );
  yInput.addEventListener("change", (e) =>
    window.Engine.setTransformNumeric("y", parseFloat(e.target.value))
  );
  wInput.addEventListener("change", (e) =>
    window.Engine.setTransformNumeric(
      "scaleX",
      parseFloat(e.target.value) / 100
    )
  );
  hInput.addEventListener("change", (e) =>
    window.Engine.setTransformNumeric(
      "scaleY",
      parseFloat(e.target.value) / 100
    )
  );
  aInput.addEventListener("change", (e) =>
    window.Engine.setTransformNumeric("rotation", parseFloat(e.target.value))
  );

  // Seletor de Âncora
  anchorSelect.addEventListener("change", (e) =>
    window.Engine.setTransformAnchor(e.target.value)
  );
}

function showCropUI() {
  const cropState = window.Engine.getCropState();
  if (!cropState) return;
  const toolState = window.Engine.getToolState("cropTool");

  selectedToolDiv.innerHTML = `
    <span style="margin-left: 10px; font-weight: 600;">Crop Tool</span>

    <div class="form-group flex" style="margin-left: 10px; flex-direction: row; align-items: center; gap: 4px;">
      <label for="cropModeSelect">Mode:</label>
      <select id="cropModeSelect" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;"> <option value="Free" ${
        toolState.mode === "Free" ? "selected" : ""
      }>Free</option>
        <option value="Fixed Ratio" ${
          toolState.mode === "Fixed Ratio" ? "selected" : ""
        }>Fixed Ratio</option>
      </select>
      <input type="number" id="cropRatioW" class="value-input" style="width: 3.5rem; padding: 2px 4px; background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; text-align: right;" value="${
        toolState.ratioW
      }">
      <span>:</span>
      <input type="number" id="cropRatioH" class="value-input" style="width: 3.5rem; padding: 2px 4px; background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; text-align: right;" value="${
        toolState.ratioH
      }">
    </div>

    <div id="anchor-container" class="numeric-slider">
      <label for="cropAnchorSelect" style="margin-left: 10px">Anchor:</label>
      <select id="cropAnchorSelect" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;">
        <option value="top-left">Top Left</option>
        <option value="top-middle">Top Middle</option>
        <option value="top-right">Top Right</option>
        <option value="center-left">Center Left</option>
        <option value="center-middle">Center</option>
        <option value="center-right">Center Right</option>
        <option value="bottom-left">Bottom Left</option>
        <option value="bottom-middle">Bottom Middle</option>
        <option value="bottom-right">Bottom Right</option>
      </select>
    </div>

    <div id="position-x-container" class="numeric-slider">
      <label for="cropPositionXNumber" style="margin-left: 10px">X:</label>
      <input type="number" step="0.1" id="cropPositionXNumber" class="value-input" style="width: 50px;" />
      <span class="unit">px</span>
    </div>
    <div id="position-y-container" class="numeric-slider">
      <label for="cropPositionYNumber" style="margin-left: 0px">Y:</label>
      <input type="number" step="0.1" id="cropPositionYNumber" class="value-input" style="width: 50px;" />
      <span class="unit">px</span>
    </div>

    <div id="size-w-container" class="numeric-slider">
      <label for="cropSizeWidthNumber" style="margin-left: 10px">W:</label>
      <input type="number" step="0.1" id="cropSizeWidthNumber" class="value-input" style="width: 50px;" />
      <span class="unit">%</span>
    </div>
    <div id="size-h-container" class="numeric-slider">
      <label for="cropSizeHeightNumber" style="margin-left: 0px">H:</label>
      <input type="number" step="0.1" id="cropSizeHeightNumber" class="value-input" style="width: 50px;" />
      <span class="unit">%</span>
    </div>

    <div id="angle-container" class="numeric-slider">
      <label for="cropAngleNumber" style="margin-left: 10px">A:</label>
      <input type="number" step="0.1" id="cropAngleNumber" class="value-input" style="width: 50px;" />
      <span class="unit">deg</span>
    </div>

    <div class="form-group flex" style="margin-left: 10px; flex-direction: row; align-items: center; gap: 4px;">
       <input type="checkbox" id="cropDeletePixels" ${
         toolState.deleteCropped ? "checked" : ""
       } />
       <label for="cropDeletePixels">Delete Cropped Pixels</label>
    </div>

    <div id="actions-container" style="margin-left: 10px; display: flex; gap: 8px; padding-right: 10px;">
      <button title="Cancel" class="action-button" id="btnCancelCrop">
        <svg-src src="assets/svg/X.svg"></svg-src>
      </button>
      <button title="Apply" class="action-button" id="btnApplyCrop" style="background: var(--accent-color);">
        <svg-src src="assets/svg/Check.svg"></svg-src>
      </button>
    </div>
  `;

  // 2. Popula os valores iniciais
  window.updateCropUI(); // Usa a função global para preencher os valores

  // 3. Adiciona listeners
  const xInput = document.getElementById("cropPositionXNumber");
  const yInput = document.getElementById("cropPositionYNumber");
  const wInput = document.getElementById("cropSizeWidthNumber");
  const hInput = document.getElementById("cropSizeHeightNumber");
  const aInput = document.getElementById("cropAngleNumber");
  const anchorSelect = document.getElementById("cropAnchorSelect");
  const modeSelect = document.getElementById("cropModeSelect");
  const ratioWInput = document.getElementById("cropRatioW");
  const ratioHInput = document.getElementById("cropRatioH");
  const deleteCheck = document.getElementById("cropDeletePixels");

  // Funções helper para UI
  const updateRatioInputsVisibility = () => {
    const show = modeSelect.value === "Fixed Ratio";
    ratioWInput.style.display = show ? "block" : "none";
    ratioHInput.style.display = show ? "block" : "none";
    // Correção: Encontrar o elemento ':' de forma mais segura
    const colon = ratioWInput.nextElementSibling;
    if (colon && colon.tagName === "SPAN") {
      colon.style.display = show ? "block" : "none";
    }
  };
  updateRatioInputsVisibility();

  // Botões de Ação
  document.getElementById("btnCancelCrop").addEventListener("click", () => {
    window.Engine.cancelCrop();
    updateSelectedToolUI();
  });

  document.getElementById("btnApplyCrop").addEventListener("click", () => {
    window.Engine.applyCrop().then(() => {
      updateSelectedToolUI();
    });
  });

  // Inputs
  xInput.addEventListener("change", (e) =>
    window.Engine.setCropNumeric("x", parseFloat(e.target.value))
  );
  yInput.addEventListener("change", (e) =>
    window.Engine.setCropNumeric("y", parseFloat(e.target.value))
  );
  wInput.addEventListener("change", (e) =>
    window.Engine.setCropNumeric("scaleX", parseFloat(e.target.value) / 100)
  );
  hInput.addEventListener("change", (e) =>
    window.Engine.setCropNumeric("scaleY", parseFloat(e.target.value) / 100)
  );
  aInput.addEventListener("change", (e) =>
    window.Engine.setCropNumeric("rotation", parseFloat(e.target.value))
  );
  anchorSelect.addEventListener("change", (e) =>
    window.Engine.setCropAnchor(e.target.value)
  );

  // Opções da Ferramenta
  modeSelect.addEventListener("change", (e) => {
    const newMode = e.target.value;
    window.Engine.setToolOption("cropTool", "mode", newMode);

    // --- INÍCIO DA CORREÇÃO (BUG 3) ---
    if (newMode === "Fixed Ratio") {
      // Pega o estado *atual* do crop
      const currentState = window.Engine.getCropState();
      if (currentState) {
        const currentW = currentState.width * currentState.scaleX;
        const currentH = currentState.height * currentState.scaleY;

        // Encontra o GCD para simplificar (ex: 400x300 -> 4:3)
        const commonDivisor = gcd(currentW, currentH);
        let newRatioW = commonDivisor === 0 ? 1 : currentW / commonDivisor;
        let newRatioH = commonDivisor === 0 ? 1 : currentH / commonDivisor;

        // Evita proporção 0 ou negativa
        if (newRatioW <= 0) newRatioW = 1;
        if (newRatioH <= 0) newRatioH = 1;

        // Define as novas proporções na engine
        window.Engine.setToolOption("cropTool", "ratioW", newRatioW);
        window.Engine.setToolOption("cropTool", "ratioH", newRatioH);

        // Atualiza os inputs na UI
        ratioWInput.value = newRatioW;
        ratioHInput.value = newRatioH;
      }
    }
    // --- FIM DA CORREÇÃO (BUG 3) ---

    updateRatioInputsVisibility();
  });
  ratioWInput.addEventListener("change", (e) => {
    window.Engine.setToolOption(
      "cropTool",
      "ratioW",
      parseFloat(e.target.value) || 1
    );
    // ADICIONAR ESTA LINHA:
    // "basedOn: 'width'" diz ao motor para manter a largura atual
    // e ajustar a altura de acordo com a nova proporção.
    window.Engine.applyCropRatio("width");
  });
  ratioHInput.addEventListener("change", (e) => {
    window.Engine.setToolOption(
      "cropTool",
      "ratioH",
      parseFloat(e.target.value) || 1
    );
    // ADICIONAR ESTA LINHA:
    // "basedOn: 'height'" diz ao motor para manter a altura atual
    // e ajustar a largura de acordo com a nova proporção.
    window.Engine.applyCropRatio("height");
  });
  deleteCheck.addEventListener("change", (e) => {
    window.Engine.setToolOption("cropTool", "deleteCropped", e.target.checked);
  });
}

function getActiveProject() {
  const activeTab = projectsTabs.querySelector("button.active:not(#homeTab)");
  if (!activeTab) return null;
  // O ID do projeto é armazenado como o ID do botão
  return projects.find((p) => p.id == activeTab.id);
}

// --- INÍCIO: NOVAS FUNÇÕES DE PROJETO ---

/**
 * Helper para extrair o nome do arquivo de um caminho (ex: "C:\bla\proj.ocfd" -> "proj")
 */
function getProjectNameFromPath(filePath) {
  if (!filePath) return "Untitled";
  // Pega a parte depois da última barra (qualquer tipo)
  const fileName = filePath.split(/[\\/]/).pop();
  // Remove a extensão .ocfd
  // const name = fileName.replace(/\.ocfd$/i, "");
  // return name;
  return fileName;
}

// --- INÍCIO DA MODIFICAÇÃO ---
// Adicione estas funções globais para marcar o estado do projeto

/** Marca o projeto ativo como "não salvo" (sujo) e atualiza a aba */
window.markActiveProjectUnsaved = function () {
  const activeProject = getActiveProject();
  if (activeProject && !activeProject.isUnsaved) {
    activeProject.isUnsaved = true;
    const activeTab = document.getElementById(activeProject.id);
    if (activeTab) {
      // const titleSpan = activeTab.querySelector("span");
      activeTab.classList.add("unsaved");
      // if (titleSpan && !titleSpan.textContent.endsWith("*")) {
      //   titleSpan.textContent += "*";
      // }
    }
  }
};

/** Marca o projeto ativo como "salvo" e atualiza a aba */
function markActiveProjectSaved(filePath) {
  const activeProject = getActiveProject();
  if (activeProject) {
    activeProject.isUnsaved = false;
    activeProject.filePath = filePath; // Armazena o caminho
    activeProject.name = getProjectNameFromPath(filePath); // Atualiza o nome

    const activeTab = document.getElementById(activeProject.id);
    if (activeTab) {
      const titleSpan = activeTab.querySelector("span");
      activeTab.classList.remove("unsaved");
      if (titleSpan) {
        titleSpan.textContent = activeProject.name; // Atualiza o nome
      }
    }
  }
}
// --- FIM DA MODIFICAÇÃO ---

/**
 * Cria um novo projeto na UI e no Engine a partir de dados de um arquivo .ocfd
 */
async function createProjectFromData(projectData, filePath = null) {
  if (!projectData || !projectData.layers) {
    alert("Erro: Arquivo de projeto inválido ou corrompido.");
    return;
  }

  // 1. Salva o estado do projeto atual (se houver um)
  const currentProject = getActiveProject();
  if (currentProject) {
    const state = window.Engine.getState();
    currentProject.layers = state.layers;
    currentProject.scale = state.scale;
    currentProject.originX = state.originX;
    currentProject.originY = state.originY;
    currentProject.selectionDataURL = state.selectionDataURL;
    currentProject.selectionBounds = state.selectionBounds;
    currentProject.activeLayerId = state.activeLayerId; // Salva o ID
  }

  // 2. Deserializar camadas: Converter dataURLs de volta para <canvas>
  const loadedLayers = await Promise.all(
    projectData.layers.map(async (layerData) => {
      if (!layerData.image) {
        // Pode ser uma camada vazia que foi salva sem imagem
        const emptyCanvas = document.createElement("canvas");
        emptyCanvas.width = layerData.width || projectData.width;
        emptyCanvas.height = layerData.height || projectData.height;
        return { ...layerData, image: emptyCanvas };
      }

      const img = new Image();
      img.src = layerData.image; // layer.image é a dataURL
      try {
        await img.decode();
      } catch (e) {
        console.error("Erro ao decodificar imagem da camada:", e, layerData);
        // Cria um canvas vazio no lugar se a imagem falhar
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = layerData.width || projectData.width;
        fallbackCanvas.height = layerData.height || projectData.height;
        return { ...layerData, image: fallbackCanvas };
      }

      // ***** INÍCIO DA CORREÇÃO *****
      // O motor espera um <img> com o .src (dataURL),
      // não um <canvas> pré-renderizado.

      // REMOVA ESTAS LINHAS:
      // const canvas = document.createElement("canvas");
      // canvas.width = img.width;
      // canvas.height = img.height;
      // canvas.getContext("2d").drawImage(img, 0, 0);

      // Reconstrói o objeto da camada, retornando o <img> carregado
      return { ...layerData, image: img };
      // ***** FIM DA CORREÇÃO *****
    })
  );

  // 3. Criar a aba (lógica similar a createProjectFromHome)
  const projectId = Date.now();
  // Remove a extensão .ocfd
  if (projectData.name && projectData.name.endsWith(".ocfd")) {
    projectData.name = projectData.name.replace(/\.ocfd$/i, "");
  }
  const projectName = projectData.name || "Untitled";

  const tab = document.createElement("button");
  tab.id = projectId;

  const tabTitle = document.createElement("span");
  tabTitle.textContent = `${projectName}.ocfd`;
  tab.appendChild(tabTitle);

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  closeBtn.className = "close-tab-btn";
  closeBtn.title = "Close Project";
  closeBtn.addEventListener("click", async (e) => {
    // <-- Adicione async
    e.stopPropagation();
    await closeProject(projectId); // <-- Adicione await
  });
  tab.appendChild(closeBtn);

  projectsTabs
    .querySelectorAll("button")
    .forEach((b) => b.classList.remove("active"));
  tab.classList.add("active");

  // Listener da aba
  tab.addEventListener("click", () => {
    if (window.Engine.isTransforming() || window.Engine.isCropping()) {
      alert("Finalize a operação atual (transform/crop) antes de trocar.");
      return;
    }

    // Salva o estado do projeto que estava ativo
    const currentProject = getActiveProject();
    if (currentProject) {
      const state = window.Engine.getState();
      currentProject.layers = state.layers;
      currentProject.scale = state.scale;
      currentProject.originX = state.originX;
      currentProject.originY = state.originY;
      currentProject.selectionDataURL = state.selectionDataURL;
      currentProject.selectionBounds = state.selectionBounds;
      currentProject.activeLayerId = state.activeLayerId; // Salva o ID
    }

    // Carrega o novo projeto
    const proj = projects.find((p) => p.id == tab.id);
    if (proj) {
      const viewportState = {
        scale: proj.scale,
        originX: proj.originX,
        originY: proj.originY,
      };
      // Carrega o projeto no Engine
      window.Engine.setProject(
        proj.width,
        proj.height,
        proj.layers,
        viewportState,
        proj.selectionDataURL,
        proj.selectionBounds,
        proj.activeLayerId // Passa o ID da camada ativa
      );
      projectsTabs
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("zoomScale").style.display = "block";
      hideHomeScreen();
    }
  });

  projectsTabs.appendChild(tab);

  // 4. Adicionar à lista de projetos
  const newProject = {
    id: projectId,
    name: projectName,
    // --- INÍCIO DA MODIFICAÇÃO ---
    filePath: filePath, // Armazena o caminho do arquivo (pode ser null)
    isUnsaved: false, // Um projeto recém-aberto está salvo
    // --- FIM DA MODIFICAÇÃO ---
    width: projectData.width,
    height: projectData.height,
    layers: loadedLayers, // Armazena as camadas com <img> VIVOS
    scale: projectData.viewport.scale,
    originX: projectData.viewport.originX,
    originY: projectData.viewport.originY,
    selectionDataURL: projectData.selection
      ? projectData.selection.dataURL
      : null,
    selectionBounds: projectData.selection
      ? projectData.selection.bounds
      : null,
    activeLayerId: projectData.activeLayerId || null,
    // ***** INÍCIO DA CORREÇÃO *****
    historyStack: projectData.historyStack || null, // Carrega o histórico
    // ***** FIM DA CORREÇÃO *****
  };
  projects.push(newProject);

  // 5. Ativar o projeto no Engine
  window.Engine.setProject(
    newProject.width,
    newProject.height,
    newProject.layers, // Passa o array de <img>
    projectData.viewport,
    newProject.selectionDataURL,
    newProject.selectionBounds,
    newProject.activeLayerId,
    // ***** INÍCIO DA CORREÇÃO *****
    newProject.historyStack // Passa o histórico para o motor
    // ***** FIM DA CORREÇÃO *****
  );

  // 6. Atualizar UI
  document.getElementById("zoomScale").style.display = "block";
  hideHomeScreen();
  window.context.resizeViewport(window.context);
}

// --- NOVO: FUNÇÃO PARA FECHAR PROJETO (MODIFICADA) ---
async function closeProject(projectId) {
  // <-- Adicionada async
  const projectIndex = projects.findIndex((p) => p.id == projectId);
  if (projectIndex === -1) return;

  const project = projects[projectIndex];

  // --- INÍCIO DA MODIFICAÇÃO ---
  let canClose = false;

  if (project.isUnsaved) {
    // Pergunta ao usuário o que fazer
    const choice = await window.electronAPI.confirmClose(project.name);

    if (choice === 0) {
      // 0: Salvar
      await saveActiveProject(); // Tenta salvar
      // Se o projeto ainda não estiver salvo (ex: usuário cancelou o "Salvar Como"),
      // não feche a aba.
      if (!project.isUnsaved) {
        canClose = true;
      }
    } else if (choice === 1) {
      // 1: Não Salvar
      canClose = true;
    } else if (choice === 2) {
      // 2: Cancelar
      canClose = false;
    }
  } else {
    // Projeto não tem alterações, pode fechar
    canClose = true;
  }

  if (!canClose) {
    return; // Usuário cancelou, aborta o fechamento
  }
  // --- FIM DA MODIFICAÇÃO ---

  // O código abaixo só executa se canClose for true
  const tabToClose = document.getElementById(projectId);
  const wasActive = tabToClose.classList.contains("active");

  let nextActiveTab = null;
  if (wasActive) {
    // ... (lógica existente para encontrar a próxima aba) ...
    if (!nextActiveTab) {
      nextActiveTab = tabToClose.previousElementSibling;
    }
  }

  // Remove project from array and tab from DOM
  projects.splice(projectIndex, 1);
  tabToClose.remove();

  if (wasActive) {
    if (nextActiveTab) {
      nextActiveTab.click();
    } else {
      homeTab.click();
    }
  }
}

// --- INÍCIO DA MODIFICAÇÃO ---
// Nova função "Salvar Como..."
async function saveActiveProjectAs() {
  const project = getActiveProject();
  if (!project) {
    alert("Nenhum projeto ativo para salvar.");
    return;
  }

  // 1. Pega o estado e serializa (lógica de serialização copiada)
  const state = window.Engine.getState();
  const serializableLayers = state.layers.map((layer) => {
    let imageDataURL;
    if (layer.image instanceof HTMLCanvasElement) {
      imageDataURL = layer.image.toDataURL();
    } else if (layer.image instanceof HTMLImageElement) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = layer.image.naturalWidth;
      tempCanvas.height = layer.image.naturalHeight;
      tempCanvas.getContext("2d").drawImage(layer.image, 0, 0);
      imageDataURL = tempCanvas.toDataURL();
    } else {
      imageDataURL = null;
    }
    return { ...layer, image: imageDataURL };
  });

  const projectData = {
    name: project.name.replace(".ocfd", ""),
    width: state.projectWidth,
    height: state.projectHeight,
    activeLayerId: state.activeLayerId,
    viewport: {
      scale: state.scale,
      originX: state.originX,
      originY: state.originY,
    },
    selection: {
      dataURL: state.selectionDataURL,
      bounds: state.selectionBounds,
    },
    layers: serializableLayers,
    historyStack: state.undoStack,
  };

  // 2. Converte para JSON e envia para o handler "saveProjectAs"
  try {
    const jsonString = JSON.stringify(projectData);
    const defaultName = `${project.name || "Untitled"}.ocfd`;

    // Chama o handler "Save As"
    const result = await window.electronAPI.saveProjectAs({
      jsonString,
      defaultName,
    });

    if (result && result.success && result.filePath) {
      // Marca como salvo com o NOVO caminho
      markActiveProjectSaved(result.filePath);
      alert("Projeto salvo em: " + result.filePath);
    } else if (result && result.error) {
      alert("Erro ao salvar o projeto: " + result.error);
    }
  } catch (err) {
    console.error("Erro ao serializar o projeto:", err);
    alert("Erro fatal ao preparar o projeto para salvar.");
  }
}

// Nova função "Salvar" inteligente
async function saveActiveProject() {
  const project = getActiveProject();
  if (!project) {
    alert("Nenhum projeto ativo para salvar.");
    return;
  }

  console.log("Salvando o projeto:", project);

  // Se o projeto não tiver um caminho, execute "Salvar Como"
  if (!project.filePath) {
    await saveActiveProjectAs();
    return;
  }

  // Se o projeto já tem um caminho, execute o "Salvar" rápido

  // 1. Pega o estado e serializa (lógica de serialização copiada)
  const state = window.Engine.getState();
  const serializableLayers = state.layers.map((layer) => {
    let imageDataURL;
    if (layer.image instanceof HTMLCanvasElement) {
      imageDataURL = layer.image.toDataURL();
    } else if (layer.image instanceof HTMLImageElement) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = layer.image.naturalWidth;
      tempCanvas.height = layer.image.naturalHeight;
      tempCanvas.getContext("2d").drawImage(layer.image, 0, 0);
      imageDataURL = tempCanvas.toDataURL();
    } else {
      imageDataURL = null;
    }
    return { ...layer, image: imageDataURL };
  });

  const projectData = {
    name: project.name,
    width: state.projectWidth,
    height: state.projectHeight,
    activeLayerId: state.activeLayerId,
    viewport: {
      scale: state.scale,
      originX: state.originX,
      originY: state.originY,
    },
    selection: {
      dataURL: state.selectionDataURL,
      bounds: state.selectionBounds,
    },
    layers: serializableLayers,
    historyStack: state.undoStack,
  };

  // 2. Converte para JSON e envia para o handler "saveProject" (rápido)
  try {
    const jsonString = JSON.stringify(projectData);

    // Chama o handler "Save" (rápido)
    const result = await window.electronAPI.saveProject({
      jsonString,
      filePath: project.filePath, // Passa o caminho existente
    });

    if (result && result.success) {
      // Marca como salvo
      markActiveProjectSaved(result.filePath);
      console.log("Projeto salvo em: " + result.filePath); // Log silencioso
    } else if (result && result.error) {
      alert("Erro ao salvar o projeto: " + result.error);
    }
  } catch (err) {
    console.error("Erro ao serializar o projeto:", err);
    alert("Erro fatal ao preparar o projeto para salvar.");
  }
}

// --- NOVO: Listener do botão "Open Project" ---
btnOpenProject.addEventListener("click", async () => {
  if (window.Engine.isTransforming() || window.Engine.isCropping()) {
    alert("Finalize a operação atual (transform/crop) antes de abrir.");
    return;
  }

  try {
    const result = await window.electronAPI.openProject();
    if (result && result.success) {
      const projectData = JSON.parse(result.content);

      // Define o nome do projeto com base no nome do arquivo, se não estiver no JSON
      if (!projectData.name) {
        projectData.name = getProjectNameFromPath(result.filePath);
      }

      // --- INÍCIO DA MODIFICAÇÃO ---
      // Passa o result.filePath para a função
      await createProjectFromData(projectData, result.filePath);
      // --- FIM DA MODIFICAÇÃO ---
    } else if (result && result.error) {
      alert("Falha ao abrir o projeto: " + result.error);
    }
  } catch (err) {
    console.error("Erro ao abrir e processar o projeto:", err);
    alert("Erro: O arquivo de projeto pode estar corrompido.");
  }
});

// Listener do botão "Save Project" (MODIFICADO)
btnSaveProject.addEventListener("click", async () => {
  await saveActiveProject();
});

// Listener do NOVO botão "Save Project As"
btnSaveProjectAs.addEventListener("click", async () => {
  await saveActiveProjectAs();
});

// --- NOVO: FUNÇÕES DA TELA INICIAL ---
function showHomeScreen() {
  homeScreen.classList.add("visible");
  mainCanvas.style.display = "none";
  document.getElementById("zoomScale").style.display = "none";
  document.getElementById("sidebar").style.display = "none";
  // document.getElementById("toolbar").style.display = "none";
  // document.getElementById("selectedtool").style.display = "none";
}

function hideHomeScreen() {
  homeScreen.classList.remove("visible");
  mainCanvas.style.display = "block";
  document.getElementById("sidebar").style.display = "flex";
  // document.getElementById("toolbar").style.display = "block";
  // document.getElementById("selectedtool").style.display = "flex";
}

function renderPresets(category) {
  const grid = document.querySelector(".home-presets-grid");
  const nameInput = document.getElementById("home-proj-name");
  const widthInput = document.getElementById("home-proj-width");
  const heightInput = document.getElementById("home-proj-height");
  grid.innerHTML = "";

  const presets = presetsData[category] || [];
  presets.forEach((p) => {
    const item = document.createElement("div");
    item.className = "preset-item";
    item.dataset.w = p.w;
    item.dataset.h = p.h;
    item.dataset.name = p.name;
    item.title = p.name;

    const previewContainerHeight = 90; // Corresponds to the CSS height
    const maxDim = Math.max(p.w, p.h);
    const scale = (previewContainerHeight / maxDim) * 0.8; // 80% of container height
    const previewBoxW = p.w * scale;
    const previewBoxH = p.h * scale;

    item.innerHTML = `
      <div class="preview">
        <div class="preview-box" style="width: ${previewBoxW}px; height: ${previewBoxH}px;"></div>
      </div>
      <div class="title">${p.name}</div>
      <div class="dims">${p.w} x ${p.h} px</div>
    `;

    item.addEventListener("click", () => {
      // Remove selection from others
      grid
        .querySelectorAll(".preset-item")
        .forEach((el) => el.classList.remove("selected"));
      // Add selection to current
      item.classList.add("selected");

      nameInput.value = p.name;
      widthInput.value = p.w;
      heightInput.value = p.h;
    });

    item.addEventListener("dblclick", () => {
      nameInput.value = p.name;
      widthInput.value = p.w;
      heightInput.value = p.h;
      document.getElementById("home-create-project").click();
    });

    grid.appendChild(item);
  });
}

function setupHomeScreen() {
  const categoriesContainer = document.querySelector(".home-categories");
  const categories = Object.keys(presetsData);
  const bgSelect = document.getElementById("home-bg-select");
  const bgColorPicker = document.getElementById("home-bg-color");

  bgSelect.addEventListener("change", () => {
    if (bgSelect.value === "custom") {
      bgColorPicker.style.display = "block";
    } else {
      bgColorPicker.style.display = "none";
    }
  });

  categories.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    if (index === 0) {
      btn.classList.add("active");
      renderPresets(cat);
    }
    btn.addEventListener("click", () => {
      categoriesContainer
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderPresets(cat);
    });
    categoriesContainer.appendChild(btn);
  });

  document
    .getElementById("home-create-project")
    .addEventListener("click", createProjectFromHome);
}

// set initial state
homeTab.classList.add("active");
showHomeScreen(); // Mostrar a tela inicial ao carregar
setupHomeScreen();

// ao clicar em Home, resetar viewport
homeTab.addEventListener("click", () => {
  if (typeof window.Engine === "undefined") {
    alert("Engine não está disponível");
    return;
  }
  // Verifica se está transformando
  if (window.Engine.isTransforming()) {
    alert(
      "Finish or cancel the current transformation before switching projects."
    );
    return;
  }
  // Verifica se está cortando
  if (window.Engine.isCropping()) {
    alert("Finish or cancel the current cropping before switching projects.");
    return;
  }

  // --- SALVAR ESTADO ANTES DE TROCAR PARA HOME ---
  const currentProject = getActiveProject();
  if (currentProject) {
    // Pega o estado atual da Engine
    const state = window.Engine.getState();
    // Salva as layers no objeto do projeto
    currentProject.layers = state.layers;
    // Salvar estado do viewport
    currentProject.scale = state.scale;
    currentProject.originX = state.originX;
    currentProject.originY = state.originY;
    currentProject.selectionDataURL = state.selectionDataURL;
    // CORREÇÃO: Usar selectionBounds
    currentProject.selectionBounds = state.selectionBounds;
    console.log(
      "Salvando layers e viewport do projeto '",
      currentProject.name,
      "' antes de ir para Home:",
      state
    );
  }
  // ---------------------------------------------

  window.Engine.resetViewport();
  projectsTabs.querySelectorAll("button").forEach((b) => {
    b.classList.remove("active");
  });
  homeTab.classList.add("active");
  showHomeScreen();
});

// show modal for new project (programmatic simple modal)
// REMOVED: function showNewProjectModal() { ... }

// --- NOVA FUNÇÃO PARA CRIAR PROJETO ---
function createProjectFromHome() {
  const w = parseInt(document.getElementById("home-proj-width").value, 10);
  const h = parseInt(document.getElementById("home-proj-height").value, 10);
  if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) {
    alert("Width/Height inválidos");
    return;
  }

  // caso estar focado em outro projeto, salvar estado antes de criar novo
  const currentProject = getActiveProject();
  if (currentProject) {
    const state = window.Engine.getState();
    currentProject.layers = state.layers;
    currentProject.scale = state.scale;
    currentProject.originX = state.originX;
    currentProject.originY = state.originY;
    currentProject.selectionDataURL = state.selectionDataURL;
    // CORREÇÃO: Usar selectionBounds
    currentProject.selectionBounds = state.selectionBounds;
    console.log(
      "Salvando estado completo do projeto '",
      currentProject.name,
      "':",
      state
    );
  }
  // ------------------------------------

  // usar um id único consistente para a aba e o projeto
  const projectId = Date.now();
  const projectName =
    document.getElementById("home-proj-name").value || "Untitled";

  // registrar aba
  const tab = document.createElement("button");
  tab.id = projectId;

  const tabTitle = document.createElement("span");
  // tabTitle.textContent = projectName;
  tabTitle.textContent = projectName + ".ocfd";
  tab.appendChild(tabTitle);

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕"; // Using times symbol for 'x'
  closeBtn.className = "close-tab-btn";
  closeBtn.title = "Close Project";
  closeBtn.addEventListener("click", async (e) => {
    // <-- Adiciona async
    e.stopPropagation();
    await closeProject(projectId); // <-- Adiciona await
  });
  tab.appendChild(closeBtn);

  projectsTabs.querySelectorAll("button").forEach((b) => {
    b.classList.remove("active");
  });
  tab.classList.add("active");

  // ao clicar na aba, trocar para o projeto
  tab.addEventListener("click", () => {
    if (typeof window.Engine === "undefined") {
      alert("Engine não está disponível");
      return;
    }
    // Verifica se está transformando
    if (window.Engine.isTransforming()) {
      alert(
        "Finish or cancel the current transformation before switching projects."
      );
      return;
    }
    // Verifica se está cortando
    if (window.Engine.isCropping()) {
      alert("Finish or cancel the current cropping before switching projects.");
      return;
    }

    // --- SALVAR ESTADO ANTES DE TROCAR ---
    const currentProject = getActiveProject();
    if (currentProject) {
      const state = window.Engine.getState();
      currentProject.layers = state.layers;
      // Salvar estado do viewport
      currentProject.scale = state.scale;
      currentProject.originX = state.originX;
      currentProject.originY = state.originY;
      currentProject.selectionDataURL = state.selectionDataURL;
      // CORREÇÃO: Usar selectionBounds
      currentProject.selectionBounds = state.selectionBounds;
      currentProject.activeLayerId = state.activeLayerId;
      console.log(
        "Salvando layers e viewport do projeto '",
        currentProject.name,
        "' antes de trocar:",
        state
      );
    }
    // ------------------------------------

    const proj = projects.find((p) => p.id == tab.id);
    console.log("Switching to project:", proj);
    if (proj) {
      // --- CARREGAR ESTADO DO VIEWPORT ---
      const viewportState = {
        scale: proj.scale,
        originX: proj.originX,
        originY: proj.originY,
      };
      window.Engine.setProject(
        proj.width,
        proj.height,
        proj.layers,
        viewportState,
        proj.selectionDataURL,
        proj.selectionBounds, // <-- CORREÇÃO: Mude de proj.selectionOffset para proj.selectionBounds
        proj.activeLayerId
      );
      // ------------------------------------
      projectsTabs.querySelectorAll("button").forEach((b) => {
        b.classList.remove("active");
      });
      tab.classList.add("active");
      document.getElementById("zoomScale").style.display = "block";
      hideHomeScreen(); // Esconde a tela inicial
    }
  });

  projectsTabs.appendChild(tab);

  // chama a engine para criar o novo projeto
  window.Engine.createNewProject(w, h);

  // --- NOVO: Adicionar camada de fundo se necessário ---
  const bgSelect = document.getElementById("home-bg-select");
  const bgColorPicker = document.getElementById("home-bg-color");
  const bgType = bgSelect.value;

  if (bgType !== "none") {
    let color;
    if (bgType === "white") color = "#ffffff";
    else if (bgType === "black") color = "#000000";
    else if (bgType === "custom") color = bgColorPicker.value;

    if (color) {
      window.Engine.addFillLayer(color, "Background");
    }
  }
  // --------------------------------------------------

  // --- INICIALIZAR PROJETO COM O ESTADO ATUAL DO VIEWPORT ---
  // Pega o estado atual após o createNewProject (que chama fitToScreen)
  const initialState = window.Engine.getState();

  projects.push({
    id: projectId,
    name: projectName,
    // --- INÍCIO DA MODIFICAÇÃO ---
    filePath: null, // Novo projeto não tem caminho
    isUnsaved: false, // Novo projeto começa "limpo"
    // --- FIM DA MODIFICAÇÃO ---
    width: w,
    height: h,
    layers: initialState.layers, // Camadas iniciais (ex: fundo)
    scale: initialState.scale,
    originX: initialState.originX,
    originY: initialState.originY,
    selectionDataURL: initialState.selectionDataURL,
    // CORREÇÃO: Usar selectionBounds
    selectionBounds: initialState.selectionBounds,
    activeLayerId: initialState.activeLayerId,
  });
  // --------------------------------------------------------

  document.getElementById("zoomScale").style.display = "block";
  hideHomeScreen(); // Esconde a tela inicial
  window.context.resizeViewport(window.context);
}

// New Project button
// btnNew.addEventListener("click", () => {
//   // Em vez de modal, apenas volta para a home tab
//   homeTab.click();
// });

// Open file (usa API exposta via preload)
btnOpen.addEventListener("click", async () => {
  if (typeof window.Engine === "undefined") {
    alert("Engine não está disponível");
    return;
  }
  if (projects.length === 0) {
    alert("Crie um novo projeto antes de abrir uma imagem");
    return;
  }
  try {
    // abre dialog e retorna caminho do arquivo
    const result = await window.electronAPI.openFile();
    if (result) {
      // window.Engine.loadImage adiciona como nova camada
      window.Engine.loadImage(result);
    }
  } catch (error) {
    console.error("Failed to open file:", error);
    alert("Failed to open file");
  }
});

// Save -> export via Engine (exportImage) que retorna dataURL
btnSave.addEventListener("click", async () => {
  if (typeof window.Engine === "undefined") {
    alert("Engine não está disponível");
    return;
  }
  if (projects.length === 0) {
    alert("Crie um novo projeto antes de salvar uma imagem");
    return;
  }
  const dataURL = window.Engine.exportImage();
  // const defaultName = `{}.png`;
  // get default name from project name
  const currentProject = getActiveProject();
  const defaultName = currentProject
    ? `${currentProject.name || "project"}.png`
    : "opencreate_export.png";
  const result = await window.electronAPI.saveFile({ dataURL, defaultName });
  if (result && result.success) {
    alert("Imagem salva em: " + result.filePath);
  } else if (result && result.error) {
    console.warn("Erro ao salvar:", result.error);
  }
});

// Filter grayscale (usa a função global applyFilter se existir)
// btnGrayscale.addEventListener("click", () => {
//   if (typeof applyFilter === "function") {
//     applyFilter(window.Filters.grayscale);
//   } else {
//     alert("Filtro não implementado (applyFilter ausente)");
//   }
// });

// NOVO: Helper para o componente de input numérico com slider
function setupNumericSlider(containerId, toolId, option, config) {
  const { min, max, isPercentage } = config;
  const container = document.getElementById(containerId);
  if (!container) return;

  const numberInput = container.querySelector('input[type="number"]');
  const rangeInput = container.querySelector('input[type="range"]');
  const toggleBtn = container.querySelector(".slider-toggle");
  const sliderContainer = container.querySelector(".slider-container");

  const updateEngine = (value) => {
    const engineValue = isPercentage ? value / 100 : value;
    window.Engine.setToolOption(toolId, option, engineValue);
    if (lastMouseEvent) {
      updateBrushPreview(lastMouseEvent);
    }
  };

  numberInput.addEventListener("input", (e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value)) value = min;
    value = Math.max(min, Math.min(max, value));
    e.target.value = value;
    rangeInput.value = value;
    updateEngine(value);
  });

  numberInput.addEventListener("wheel", (e) => {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let value = parseInt(numberInput.value, 10);
    if (e.deltaY < 0) {
      value += step;
    } else {
      value -= step;
    }
    value = Math.max(min, Math.min(max, value));
    numberInput.value = value;
    rangeInput.value = value;
    updateEngine(value);
  });

  rangeInput.addEventListener("input", (e) => {
    const value = parseInt(e.target.value, 10);
    numberInput.value = value;
    updateEngine(value);
  });

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sliderContainer.classList.toggle("visible");
  });

  // Fecha o dropdown se clicar fora
  document.addEventListener(
    "click",
    (e) => {
      if (!container.contains(e.target)) {
        sliderContainer.classList.remove("visible");
      }
    },
    true
  );
}

// Atualiza a UI da ferramenta selecionada
function updateSelectedToolUI() {
  // NOVO: Verifica o modo de transformação primeiro
  if (window.Engine.isTransforming()) {
    showTransformUI(); // Renderiza a UI de transformação
    return;
  }

  if (window.Engine.isCropping()) {
    showCropUI();
    return;
  }

  const activeToolId = window.Engine.getActiveToolId();
  const toolState = window.Engine.getToolState(activeToolId);

  // Sincroniza o botão "active" na barra de ferramentas da esquerda
  // com o estado atual da engine.
  toolButtons.forEach((btn) => {
    if (btn.id === activeToolId) {
      btn.setAttribute("active", "true");
    } else {
      btn.removeAttribute("active");
    }
  });

  const activeToolButton = document.getElementById(activeToolId);

  // Limpa a div de opções se nenhuma ferramenta estiver ativa
  if (!activeToolButton) {
    selectedToolDiv.innerHTML = "";
    return;
  }

  const toolName = activeToolButton.getAttribute("title").split(" (")[0];

  // --- LÓGICA OTIMIZADA PARA A FERRAMENTA DE SELEÇÃO ---
  if (activeToolId === "selectTool") {
    // Verifica se a UI da ferramenta de seleção já foi renderizada.
    // Usamos um ID ou uma classe específica para a verificação.
    let selectToolUI = selectedToolDiv.querySelector("#selectToolOptions");

    // Se a UI não existir, cria-a pela primeira vez.
    if (!selectToolUI) {
      const modes = ["replace", "unite", "subtract", "intersect"];
      const modeIcons = {
        replace: "assets/svg/SelectTool_Replace.svg",
        unite: "assets/svg/SelectTool_Union.svg",
        subtract: "assets/svg/SelectTool_Subtract.svg",
        intersect: "assets/svg/SelectTool_Intersect.svg",
      };
      const modeTitles = {
        replace: "New Selection",
        unite: "Add to Selection",
        subtract: "Subtract from Selection",
        intersect: "Intersect with Selection",
      };

      const modeButtonsHTML = modes
        .map(
          (mode) => `
          <button 
              class="select-mode-button" 
              id="select-mode-${mode}" 
              title="${modeTitles[mode]}">
              <svg-src src="${modeIcons[mode]}"></svg-src>
          </button>
      `
        )
        .join("");

      // Monta o HTML completo e o insere no DOM
      selectedToolDiv.innerHTML = `
        <span style="margin-left: 10px">${toolName}</span>
        <div id="selectToolOptions" class="select-modes">
            <div class="select-modes">${modeButtonsHTML}</div>
        </div>
      `;

      // Adiciona os listeners de clique UMA ÚNICA VEZ.
      document.querySelectorAll(".select-mode-button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.id.replace("select-mode-", "");
          lastUserSelectMode = mode;
          window.Engine.setToolOption("selectTool", "mode", mode);
          // Chama a função novamente para atualizar a classe 'active',
          // mas desta vez ela não vai recriar o HTML.
          updateSelectedToolUI();
        });
      });
    }

    // --- ATUALIZAÇÃO DE CLASSE (executa sempre para a ferramenta de seleção) ---
    // Garante que o botão correto tenha a classe 'active'.
    const currentMode = toolState.mode;
    document.querySelectorAll(".select-mode-button").forEach((btn) => {
      const buttonMode = btn.id.replace("select-mode-", "");
      // O método toggle com o segundo argumento booleano é perfeito para isso.
      btn.classList.toggle("active", buttonMode === currentMode);
    });
    return; // Finaliza a função aqui para não processar outras ferramentas
  }

  // --- INÍCIO DA CORREÇÃO (RECURSO 2): UI Ociosa para Crop Tool ---
  else if (activeToolId === "cropTool") {
    // Esta é a UI para quando a ferramenta está selecionada,
    // mas o modo de corte (isCropping) ainda não está ativo.
    selectedToolDiv.innerHTML = `
      <span style="margin-left: 10px;">${toolName}</span>

      <div class="form-group flex" style="margin-left: 10px; flex-direction: row; align-items: center; gap: 4px;">
        <label for="cropModeSelect">Mode:</label>
        <select id="cropModeSelect" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;"> <option value="Free" ${
          toolState.mode === "Free" ? "selected" : ""
        }>Free</option>
          <option value="Fixed Ratio" ${
            toolState.mode === "Fixed Ratio" ? "selected" : ""
          }>Fixed Ratio</option>
        </select>
        <input type="number" id="cropRatioW" class="value-input" style="width: 3.5rem; padding: 2px 4px; background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; text-align: right;" value="${
          toolState.ratioW
        }">
        <span>:</span>
        <input type="number" id="cropRatioH" class="value-input" style="width: 3.5rem; padding: 2px 4px; background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; text-align: right;" value="${
          toolState.ratioH
        }">
      </div>
      
      <div class="form-group flex" style="margin-left: 10px; flex-direction: row; align-items: center; gap: 4px;">
         <input type="checkbox" id="cropDeletePixels" ${
           toolState.deleteCropped ? "checked" : ""
         } />
         <label for="cropDeletePixels">Delete Cropped Pixels</label>
      </div>
    `;

    // Adiciona listeners para estes controles
    const modeSelect = document.getElementById("cropModeSelect");
    const ratioWInput = document.getElementById("cropRatioW");
    const ratioHInput = document.getElementById("cropRatioH");
    const deleteCheck = document.getElementById("cropDeletePixels");

    const updateRatioInputsVisibility = () => {
      const show = modeSelect.value === "Fixed Ratio";
      ratioWInput.style.display = show ? "block" : "none";
      ratioHInput.style.display = show ? "block" : "none";
      // Correção: Encontrar o elemento ':' de forma mais segura
      const colon = ratioWInput.nextElementSibling;
      if (colon && colon.tagName === "SPAN") {
        colon.style.display = show ? "block" : "none";
      }
    };
    updateRatioInputsVisibility();

    modeSelect.addEventListener("change", (e) => {
      window.Engine.setToolOption("cropTool", "mode", e.target.value);
      updateRatioInputsVisibility();
    });
    ratioWInput.addEventListener("change", (e) => {
      window.Engine.setToolOption(
        "cropTool",
        "ratioW",
        parseFloat(e.target.value) || 1
      );
    });
    ratioHInput.addEventListener("change", (e) => {
      window.Engine.setToolOption(
        "cropTool",
        "ratioH",
        parseFloat(e.target.value) || 1
      );
    });
    deleteCheck.addEventListener("change", (e) => {
      window.Engine.setToolOption(
        "cropTool",
        "deleteCropped",
        e.target.checked
      );
    });

    return; // Finaliza a função
  }
  // --- FIM DA CORREÇÃO ---

  // --- LÓGICA PARA AS OUTRAS FERRAMENTAS (permanece a mesma) ---
  // Se a ferramenta ativa não for a de seleção, limpa o conteúdo e
  // reconstrói a UI para a ferramenta correspondente.
  let toolOptionsHTML = "";

  if (
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool"
  ) {
    const isPencilLike =
      activeToolId === "pencilTool" ||
      (activeToolId === "eraserTool" && toolState.mode === "pencil");
    const maxSize = isPencilLike ? 50 : 200;

    const sizeHTML = `
      <div class="numeric-slider" id="size-container">
        <label for="toolSizeNumber" style="margin-left: 10px">Size:</label>
        <input type="number" id="toolSizeNumber" value="${toolState.size}" min="1" max="${maxSize}" class="value-input">
        <span class="unit">px</span>
        <button class="slider-toggle">▼</button>
        <div class="slider-container">
          <input type="range" id="toolSizeRange" value="${toolState.size}" min="1" max="${maxSize}">
        </div>
      </div>
    `;

    if (activeToolId === "brushTool") {
      const colorHTML = `<input type="color" id="toolColor" value="${toolState.color}" style="margin-left: 10px">`;
      const hardnessValue = Math.round((toolState.hardness || 1.0) * 100);
      const hardnessHTML = `
        <div class="numeric-slider" id="hardness-container">
          <label for="toolHardnessNumber" style="margin-left: 10px">Hardness:</label>
          <input type="number" id="toolHardnessNumber" value="${hardnessValue}" min="0" max="100" class="value-input">
          <span class="unit">%</span>
          <button class="slider-toggle">▼</button>
          <div class="slider-container">
            <input type="range" id="toolHardnessRange" value="${hardnessValue}" min="0" max="100">
          </div>
        </div>
      `;
      toolOptionsHTML = colorHTML + sizeHTML + hardnessHTML;
    } else if (activeToolId === "pencilTool") {
      const colorHTML = `<input type="color" id="toolColor" value="${toolState.color}" style="margin-left: 10px">`;
      const shapeHTML = `
        <span style="margin-left: 10px">Shape:</span>
        <select id="toolShape" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;">
          <option value="square" ${
            toolState.shape === "square" ? "selected" : ""
          }>Square</option>
          <option value="sphere" ${
            toolState.shape === "sphere" ? "selected" : ""
          }>Sphere</option>
        </select>
      `;
      toolOptionsHTML = colorHTML + sizeHTML + shapeHTML;
    } else if (activeToolId === "eraserTool") {
      const modeHTML = `
        <span style="margin-left: 10px">Mode:</span>
        <select id="toolMode" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;">
          <option value="brush" ${
            toolState.mode === "brush" ? "selected" : ""
          }>Brush</option>
          <option value="pencil" ${
            toolState.mode === "pencil" ? "selected" : ""
          }>Pencil</option>
        </select>
      `;
      let modeSpecificHTML = "";
      if (toolState.mode === "brush") {
        const hardnessValue = Math.round((toolState.hardness || 1.0) * 100);
        modeSpecificHTML = `
          <div class="numeric-slider" id="hardness-container">
            <label for="toolHardnessNumber" style="margin-left: 10px">Hardness:</label>
            <input type="number" id="toolHardnessNumber" value="${hardnessValue}" min="0" max="100" class="value-input">
            <span class="unit">%</span>
            <button class="slider-toggle">▼</button>
            <div class="slider-container">
              <input type="range" id="toolHardnessRange" value="${hardnessValue}" min="0" max="100">
            </div>
          </div>
        `;
      } else {
        // pencil mode
        modeSpecificHTML = `
          <span style="margin-left: 10px">Shape:</span>
          <select id="toolShape" style="background: #333; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 2px;">
            <option value="square" ${
              toolState.shape === "square" ? "selected" : ""
            }>Square</option>
            <option value="sphere" ${
              toolState.shape === "sphere" ? "selected" : ""
            }>Sphere</option>
          </select>
        `;
      }
      toolOptionsHTML = sizeHTML + modeHTML + modeSpecificHTML;
    }
  }

  // Define o HTML para as outras ferramentas.
  selectedToolDiv.innerHTML = `
    <span style="margin-left: 10px">${toolName}</span>
    ${toolOptionsHTML}
  `;

  // Adiciona listeners para as opções das outras ferramentas (código existente).
  if (document.getElementById("toolColor")) {
    document.getElementById("toolColor").addEventListener("input", (e) => {
      window.Engine.setToolOption(activeToolId, "color", e.target.value);
    });
  }
  if (document.getElementById("size-container")) {
    const isPencilLike =
      activeToolId === "pencilTool" ||
      (activeToolId === "eraserTool" && toolState.mode === "pencil");
    const max = isPencilLike ? 50 : 200;
    setupNumericSlider("size-container", activeToolId, "size", {
      min: 1,
      max: max,
      isPercentage: false,
    });
  }
  if (document.getElementById("hardness-container")) {
    setupNumericSlider("hardness-container", activeToolId, "hardness", {
      min: 0,
      max: 100,
      isPercentage: true,
    });
  }
  if (document.getElementById("toolShape")) {
    document.getElementById("toolShape").addEventListener("change", (e) => {
      window.Engine.setToolOption(activeToolId, "shape", e.target.value);
      if (lastMouseEvent) {
        updateBrushPreview(lastMouseEvent);
      }
    });
  }
  if (document.getElementById("toolMode")) {
    document.getElementById("toolMode").addEventListener("change", (e) => {
      window.Engine.setToolOption(activeToolId, "mode", e.target.value);
      updateSelectedToolUI();
    });
  }
}

// Modify the tool buttons click handler
toolButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    // Recebe o evento 'e'
    if (window.Engine.isTransforming()) {
      alert("Apply or Cancel the current transformation first.");
      e.stopImmediatePropagation(); // Impede que a ferramenta seja trocada
      return;
    }
    if (window.Engine.isCropping()) {
      alert("Apply or Cancel the current crop first.");
      e.stopImmediatePropagation();
      return;
    }

    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");

    // --- CORREÇÃO (RECURSO 2) ---
    // Apenas seleciona a ferramenta. A engine (via input)
    // decidirá quando entrar no modo de corte.
    window.Engine.setActiveTool(btn.id);
    // --- FIM DA CORREÇÃO ---

    /* --- CÓDIGO ANTIGO QUE VOCÊ TINHA ---
    if (btn.id === "cropTool") {
      window.Engine.enterCropMode();
    } else {
      window.Engine.setActiveTool(btn.id);
    }
    */

    updateSelectedToolUI();
    mainCanvas.style.cursor = ""; // Reset cursor on tool change

    // A CORREÇÃO: Força a atualização da pré-visualização
    // Se o clique foi programático (via atalho), usa o último evento de mouse conhecido
    if (lastMouseEvent) {
      updateBrushPreview(lastMouseEvent);
    }

    // Se a ferramenta for typeTool, renderize as opções:
    if (btn.id === "typeTool") {
      if (typeof window.updateTypeToolOptions === "function") {
        window.updateTypeToolOptions();
      }
    }
  });
});

/** Constrói a UI da barra de propriedades para a Type Tool */
window.updateTypeToolOptions = function () {
  const selectedToolDiv = document.getElementById("selectedtool");
  if (!selectedToolDiv) return;

  selectedToolDiv.innerHTML = ""; // Limpa opções anteriores

  const context = window.Engine.getContext();
  // Pega opções atuais ou define padrões
  const options = context.tools["typeTool"] || {
    color: "#000000",
    size: 24,
    align: "left",
    text: "Type Here",
  };

  // -- 1. Cor --
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = options.color;
  colorInput.title = "Text Color";
  colorInput.oninput = (e) => {
    window.Engine.setToolOption("typeTool", "color", e.target.value);
    updateActiveTextLayerProp("color", e.target.value);
  };

  // -- 2. Tamanho (px) --
  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.min = "8";
  sizeInput.value = options.size;
  sizeInput.style.width = "50px";
  sizeInput.title = "Font Size (px)";
  sizeInput.onchange = (e) => {
    const val = parseInt(e.target.value, 10);
    window.Engine.setToolOption("typeTool", "size", val);
    updateActiveTextLayerProp("size", val);
  };

  // -- 3. Alinhamento --
  const alignSelect = document.createElement("select");
  ["left", "center", "right"].forEach((align) => {
    const opt = document.createElement("option");
    opt.value = align;
    opt.textContent = align.charAt(0).toUpperCase() + align.slice(1);
    if (align === options.align) opt.selected = true;
    alignSelect.appendChild(opt);
  });
  alignSelect.onchange = (e) => {
    window.Engine.setToolOption("typeTool", "align", e.target.value);
    updateActiveTextLayerProp("align", e.target.value);
  };

  // -- 4. Input de Texto Rápido --
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "Text content...";
  // Se houver uma camada ativa de texto, mostre o texto dela, senão mostre o padrão da ferramenta
  const activeL = context.layers.find((l) => l.id === context.activeLayer);
  if (activeL && activeL.type === "text") {
    textInput.value = activeL.text;
  } else {
    textInput.value = options.text;
  }

  textInput.style.width = "150px";
  textInput.oninput = (e) => {
    window.Engine.setToolOption("typeTool", "text", e.target.value);
    updateActiveTextLayerProp("text", e.target.value);
  };

  // Montagem da barra
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.alignItems = "center";

  container.appendChild(document.createTextNode("Color:"));
  container.appendChild(colorInput);
  container.appendChild(document.createTextNode("Size:"));
  container.appendChild(sizeInput);
  container.appendChild(alignSelect);
  container.appendChild(textInput);

  selectedToolDiv.appendChild(container);
};

/** Função auxiliar para atualizar a camada ativa em tempo real */
function updateActiveTextLayerProp(prop, value) {
  const context = window.Engine.getContext();
  const layer = context.layers.find((l) => l.id === context.activeLayer);

  // Só atualiza se for camada de texto
  if (layer && layer.type === "text") {
    layer[prop] = value;

    // Se mudou texto ou tamanho, precisa recalcular a largura (bounding box)
    if (prop === "text" || prop === "size" || prop === "font") {
      const tempCtx = document.createElement("canvas").getContext("2d");
      tempCtx.font = `${layer.size}px ${layer.font || "system-ui"}`;
      const metrics = tempCtx.measureText(layer.text);
      layer.width = Math.ceil(metrics.width);
      layer.height = layer.size; // Aproximação

      if (prop === "text") layer.name = value.substring(0, 15);
    }

    context.saveState();
    context.draw();
  }
}

// Add empty layer button handler
btnAddEmptyLayer.addEventListener("click", () => {
  const activeProject = getActiveProject();
  if (!activeProject) {
    alert("Create a project first");
    return;
  }
  window.Engine.createEmptyLayer();
});

// ***** INÍCIO DA ADIÇÃO *****
// Delete active layer button handler
btnDeleteActiveLayer.addEventListener("click", () => {
  const activeProject = getActiveProject();
  if (!activeProject) {
    alert("Create a project first");
    return;
  }

  // O engine.js expõe o 'context' globalmente
  if (!window.context || !window.context.activeLayer) {
    console.warn("No active layer to delete.");
    return;
  }

  const { layers, activeLayer, saveState, draw, setActiveLayer } =
    window.context;
  const layerIdToDelete = activeLayer.id;

  const indexToDelete = layers.findIndex((l) => l.id === layerIdToDelete);
  if (indexToDelete === -1) return;

  // Remove a camada
  layers.splice(indexToDelete, 1);

  // Determina a nova camada ativa
  let newActiveId = null;
  if (layers.length > 0) {
    // Tenta selecionar a camada que ficou no mesmo índice (a camada "abaixo")
    // Se deletamos a última, seleciona a nova última
    const newIndex = Math.min(indexToDelete, layers.length - 1);
    newActiveId = layers[newIndex].id;
  }

  // `setActiveLayer` (exposto pelo engine) cuida de definir
  // context.activeLayer e atualizar o painel
  setActiveLayer(newActiveId);

  // Salva o estado e redesenha
  saveState();
  window.Engine.updateLayersPanel(); // Atualiza a UI de camadas
  draw();
});
// ***** FIM DA ADIÇÃO *****

// MODIFICADO: Adicionar atalhos de teclado
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") {
    // NOVO: Permite Enter/Escape mesmo focado nos inputs de transformação
    if (window.Engine.isTransforming()) {
      if (e.key === "Enter") {
        e.preventDefault();
        // Remove o foco do input para aplicar o valor para transformação
        e.target.blur();
        // document.getElementById("btnApplyTransform").click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.target.blur();
        // document.getElementById("btnCancelTransform").click();
      }
    }
    return; // Ignora outros atalhos se estiver em um input
  }

  // NOVO: Atalhos de Transformação (Enter/Escape)
  if (window.Engine.isTransforming()) {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btnApplyTransform").click();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      document.getElementById("btnCancelTransform").click();
      return;
    }
  }

  if (window.Engine.isCropping()) {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btnApplyCrop").click();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      document.getElementById("btnCancelCrop").click();
      return;
    }
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case "v":
        document.getElementById("moveTool").click();
        break;
      case "m":
        document.getElementById("selectTool").click();
        break;
      case "c": // <-- ADICIONAR ATALHO DE CORTE
        document.getElementById("cropTool").click();
        break;
      case "b":
        document.getElementById("brushTool").click();
        break;
      case "n":
        document.getElementById("pencilTool").click();
        break;
      case "e":
        document.getElementById("eraserTool").click();
        break;
      // NOVO: Atalho para a tecla Delete
      case "delete":
        e.preventDefault();
        window.Engine.deleteSelectionContent();
        break;
    }
  }

  // Common shortcuts
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      // NOVO: Atalho de Transformação (Ctrl/Cmd+T)
      case "t":
        e.preventDefault();
        const _activeProject = getActiveProject();
        if (_activeProject) {
          window.Engine.enterTransformMode();
          updateSelectedToolUI(); // Atualiza a UI para mostrar a barra de transformação
        }
        break;
      case "a":
        e.preventDefault();
        window.Engine.selectAll();
        break;
      case "d":
        e.preventDefault();
        window.Engine.clearSelection();
        break;

      case "c":
        e.preventDefault();
        window.Engine.copySelection();
        break;

      case "v":
        e.preventDefault();
        window.Engine.pasteFromClipboard();
        break;

      // NOVO: Atalho para Recortar (Cut)
      case "x":
        e.preventDefault();
        window.Engine.cutSelection();
        break;

      case "n":
        e.preventDefault();
        showNewProjectModal();
        break;
      case "o":
        e.preventDefault();
        btnOpen.click();
        break;
      // --- INÍCIO DA MODIFICAÇÃO ---
      case "s":
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+S -> Salvar Como...
          saveActiveProjectAs();
        } else {
          // Ctrl+S -> Salvar
          saveActiveProject();
        }
        break;
      // --- FIM DA MODIFICAÇÃO ---
      case "w":
        e.preventDefault();
        const activeProject = getActiveProject();
        // fechar projeto ativo
        if (activeProject) {
          closeProject(activeProject.id); // Chama a função de fechar (agora assíncrona)
        } else {
          // else, se estiver na home tab, fechar o app
          window.close(); // Fecha a janela atual
        }
        break;
      case "z":
        e.preventDefault();
        if (window.Engine.isTransforming()) return; // Não faz undo/redo durante transformação
        if (window.Engine.isCropping()) return; // Não faz undo/redo durante corte
        if (e.shiftKey) {
          window.Engine.redo();
        } else {
          window.Engine.undo();
        }
        break;
    }
  }
});

/**
 * NOVO: Atualiza o modo da ferramenta de seleção com base nas teclas modificadoras (Shift/Alt).
 */
function updateSelectionModeFromKeys(e) {
  // Só executa se a ferramenta de seleção estiver ativa
  if (window.Engine.getActiveToolId() !== "selectTool") return;

  // Não muda o modo se o usuário já estiver no meio de um arrasto de seleção
  if (window.Engine.isSelecting()) return;

  let newMode;

  // Define o modo com base na combinação de teclas
  if (e.shiftKey && e.altKey) {
    newMode = "intersect";
  } else if (e.shiftKey) {
    newMode = "unite";
  } else if (e.altKey) {
    newMode = "subtract";
  } else {
    // Se nenhuma tecla estiver pressionada, volta ao último modo que o usuário clicou
    newMode = lastUserSelectMode;
  }

  // Pega o modo atual para evitar atualizações desnecessárias
  const currentMode = window.Engine.getToolState("selectTool").mode;

  if (newMode !== currentMode) {
    window.Engine.setToolOption("selectTool", "mode", newMode);
    updateSelectedToolUI(); // Atualiza a UI para mostrar o botão ativo correto
  }
}

// NOVO: Adiciona os listeners para keydown e keyup
document.addEventListener("keydown", (e) => {
  // Previne disparos repetidos se a tecla for mantida pressionada
  if (e.repeat) return;
  // Filtra para só chamar a função se Shift ou Alt forem pressionadas
  if (e.key === "Shift" || e.key === "Alt") {
    updateSelectionModeFromKeys(e);
  }
});

document.addEventListener("keyup", (e) => {
  // Filtra para só chamar a função se Shift ou Alt forem soltas
  if (e.key === "Shift" || e.key === "Alt") {
    updateSelectionModeFromKeys(e);
  }
});

// --- NOVO: LÓGICA DE PRÉ-VISUALIZAÇÃO DO PINCEL ---

function updateBrushPreview(e) {
  const activeToolId = window.Engine.getActiveToolId();
  const toolState = window.Engine.getToolState(activeToolId);

  if (!toolState || typeof toolState.size === "undefined") {
    brushPreview.style.display = "none";
    return;
  }

  // Esconde a pré-visualização se não está no canvas
  if (e.target !== mainCanvas && !mainCanvas.contains(e.target)) {
    brushPreview.style.display = "none";
    return;
  }

  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolState.mode === "pencil");

  if (isPencilMode && toolState.shape === "square") {
    brushPreview.style.borderRadius = "0";
  } else {
    brushPreview.style.borderRadius = "50%";
  }

  const engineState = window.Engine.getState();
  const currentScale = engineState.scale;

  let effectiveSize = toolState.size;
  if (!isPencilMode) {
    // It's a brush
    const hardness =
      typeof toolState.hardness === "number" ? toolState.hardness : 1.0;
    effectiveSize = toolState.size * (1 + (1 - hardness) * 0.5);
  }
  const previewSize = effectiveSize * currentScale;

  const rect = canvasContainer.getBoundingClientRect();
  // Coordenadas do mouse relativas ao canvasContainer
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;

  // 1. Coordenadas do mouse relativas ao #mainCanvas (para a engine)
  const tabsHeight = projectsTabs ? projectsTabs.offsetHeight : 0;
  const canvasMouseX = mouseX;
  const canvasMouseY = mouseY - tabsHeight; // Subtrai a altura das abas

  let finalScreenX = mouseX;
  let finalScreenY = mouseY;

  // Snap preview to pixel grid for pencil tool
  if (isPencilMode) {
    if (window.Engine.screenToProject && window.Engine.projectToScreen) {
      // 2. Converte a coordenada do mouse (relativa ao #mainCanvas) para o espaço do projeto
      const projectCoords = window.Engine.screenToProject(
        canvasMouseX,
        canvasMouseY
      );

      // 3. Arredonda para o pixel (top-left)
      const snappedProjectX = Math.floor(projectCoords.x);
      const snappedProjectY = Math.floor(projectCoords.y);

      const size = toolState.size;
      let centerX, centerY;

      if (size % 2 !== 0) {
        // 4. (Odd) Calcula o centro do pixel: (X + 0.5, Y + 0.5)
        centerX = snappedProjectX + 0.5;
        centerY = snappedProjectY + 0.5;
      } else {
        // 4. (Even) Calcula o centro do bloco NxN: (X, Y)
        centerX = snappedProjectX;
        centerY = snappedProjectY;
      }

      // 5. Converte o centro do pixel/bloco de volta para coordenadas de tela (relativas ao #mainCanvas)
      const screenCoords = window.Engine.projectToScreen(centerX, centerY);

      // 6. Define a posição final da preview (relativa ao #canvasContainer)
      // Adicionamos a altura das abas de volta, pois o preview é posicionado em relação ao container
      finalScreenX = screenCoords.x;
      finalScreenY = screenCoords.y + tabsHeight;
    }
  }

  brushPreview.style.width = `${previewSize}px`;
  brushPreview.style.height = `${previewSize}px`;
  brushPreview.style.left = `${finalScreenX}px`;
  brushPreview.style.top = `${finalScreenY}px`;

  // Garante que a pré-visualização esteja visível se for uma ferramenta de desenho
  if (
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool"
  ) {
    brushPreview.style.display = "block";
  }
}

// Função para renderizar a barra de opções
function renderTypeToolOptions() {
  selectedToolDiv.innerHTML = "";
  const context = window.Engine.getContext();
  const opts = context.tools["typeTool"];

  // 1. Cor
  const colorInp = document.createElement("input");
  colorInp.type = "color";
  colorInp.value = opts.color;
  colorInp.oninput = (e) => {
    window.Engine.setToolOption("typeTool", "color", e.target.value);
    updateActiveTextLayer("color", e.target.value);
  };

  // 2. Tamanho
  const sizeInp = document.createElement("input");
  sizeInp.type = "number";
  sizeInp.value = opts.size;
  sizeInp.min = 1;
  sizeInp.style.width = "60px";
  sizeInp.onchange = (e) => {
    const val = Number(e.target.value);
    window.Engine.setToolOption("typeTool", "size", val);
    updateActiveTextLayer("size", val);
  };

  // 3. Alinhamento
  const alignSel = document.createElement("select");
  ["left", "center", "right", "justify"].forEach((al) => {
    const o = document.createElement("option");
    o.value = al;
    o.text = al;
    if (al === opts.align) o.selected = true;
    alignSel.appendChild(o);
  });
  alignSel.onchange = (e) => {
    window.Engine.setToolOption("typeTool", "align", e.target.value);
    updateActiveTextLayer("align", e.target.value);
  };

  // 4. Texto (Edição rápida)
  const textInp = document.createElement("input");
  textInp.type = "text";
  textInp.placeholder = "Type content...";
  textInp.value = opts.text;
  textInp.style.width = "200px";
  textInp.oninput = (e) => {
    window.Engine.setToolOption("typeTool", "text", e.target.value);
    updateActiveTextLayer("text", e.target.value);
  };

  // Layout
  selectedToolDiv.style.display = "flex";
  selectedToolDiv.style.gap = "10px";
  selectedToolDiv.style.alignItems = "center";
  selectedToolDiv.append(
    "Color:",
    colorInp,
    "Size:",
    sizeInp,
    alignSel,
    textInp
  );
}

// Atualiza a camada em tempo real
function updateActiveTextLayer(prop, val) {
  const context = window.Engine.getContext();
  const layer = context.layers.find((l) => l.id === context.activeLayer);

  if (layer && layer.type === "text") {
    layer[prop] = val;

    // Recalcular largura se mudar texto ou tamanho (para bounding box)
    if (prop === "text" || prop === "size" || prop === "font") {
      const tempCtx = document.createElement("canvas").getContext("2d");
      tempCtx.font = `${layer.size}px ${layer.font}`;
      layer.width = Math.ceil(tempCtx.measureText(layer.text).width);
      layer.height = layer.size;
      if (prop === "text") layer.name = val.substring(0, 15);
    }

    context.saveState();
    context.draw();
  }
}

// Expor função para o engine.js chamar quando clicar numa camada existente
window.updateTypeToolUI = renderTypeToolOptions;

canvasContainer.addEventListener("mouseenter", (e) => {
  // Armazena o evento para o caso de um atalho de teclado ser usado
  lastMouseEvent = e;
  const activeToolId = window.Engine.getActiveToolId();
  if (
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool"
  ) {
    brushPreview.style.display = "block";
  }
});

canvasContainer.addEventListener("mouseleave", () => {
  brushPreview.style.display = "none";
});

// MODIFICADO: O mousemove agora armazena o evento mais recente
canvasContainer.addEventListener("mousemove", (e) => {
  // Armazena continuamente o evento mais recente do mouse
  lastMouseEvent = e;

  const activeToolId = window.Engine.getActiveToolId();
  if (activeToolId === "selectTool") {
    const rect = canvasContainer.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top - projectsTabs.offsetHeight;
    if (window.Engine.screenToProject) {
      const projCoords = window.Engine.screenToProject(canvasX, canvasY);

      // CORREÇÃO: Apenas mostra o cursor de movimento se o modo permitir
      const toolState = window.Engine.getToolState("selectTool");
      const canMoveSelection =
        toolState.mode === "replace" || toolState.mode === "unite";

      if (
        canMoveSelection &&
        window.Engine.isPointInSelection(projCoords.x, projCoords.y)
      ) {
        mainCanvas.style.cursor = window.Engine.isTransforming() ? "" : "move";
      } else {
        mainCanvas.style.cursor = window.Engine.isTransforming()
          ? ""
          : "crosshair";
      }
    }
  } else {
    mainCanvas.style.cursor = ""; // Reset to default/CSS-defined
  }

  updateBrushPreview(e);
});

// /**
//  * --- NOVO: LÓGICA DE ARRASTAR E SOLTAR (DRAG & DROP) ---
//  */
// canvasContainer.addEventListener("dragover", (e) => {
//   e.preventDefault(); // MUITO IMPORTANTE: Prevenir o comportamento padrão para permitir o drop.
//   e.stopPropagation();
//   // Verificar se há arquivos sendo arrastados
//   if (e.dataTransfer.items) {
//     const hasFiles = Array.from(e.dataTransfer.items).some(
//       (item) => item.kind === "file"
//     );
//     if (!hasFiles) return; // Se não houver arquivos, não faz nada
//   }
//   // Verificar se há um projeto ativo
//   const activeProject = getActiveProject();
//   if (!activeProject) return; // Se não houver projeto, não faz nada
//   // Opcional: Adicionar um feedback visual, como uma borda
//   // canvasContainer.style.outline = "2px dashed var(--accent-color)";
//   canvasContainer.classList.add("drag-over");
// });

// canvasContainer.addEventListener("dragleave", (e) => {
//   e.preventDefault();
//   e.stopPropagation();
//   // Remove o feedback visual
//   // canvasContainer.style.outline = "none";
//   canvasContainer.classList.remove("drag-over");
// });

// // --- MODIFICADO: Listener de Drop no CONTAINER DO CANVAS ---
// canvasContainer.addEventListener("drop", async (e) => {
//   e.preventDefault();
//   e.stopPropagation();
//   canvasContainer.classList.remove("drag-over");

//   const files = e.dataTransfer.files;
//   if (files.length === 0) return;

//   // --- LÓGICA ATUALIZADA ---

//   // Se estivermos na tela inicial, abra projetos ou imagens como novos projetos
//   if (homeScreen.classList.contains("visible")) {
//     let fileToOpen = null;
//     // Prioriza arquivos .ocfd
//     fileToOpen = Array.from(files).find((f) => f.name.endsWith(".ocfd"));

//     if (fileToOpen) {
//       // Abre o projeto
//       try {
//         // --- CORREÇÃO ---
//         // O renderer pode ler o conteúdo do arquivo arrastado diretamente.
//         const fileContent = await fileToOpen.text();
//         // --- FIM DA CORREÇÃO ---

//         const projectData = JSON.parse(fileContent);

//         console.log("projectData:", projectData);

//         if (!projectData.name) {
//           projectData.name = getProjectNameFromPath(fileToOpen.name);
//         }
//         await createProjectFromData(projectData);
//       } catch (err) {
//         console.error("Erro ao ler ou processar o arquivo:", err);
//         alert("Erro: Arquivo de projeto corrompido ou ilegível.");
//       }
//     } else {
//       // Se não for .ocfd, procura a primeira imagem
//       fileToOpen = Array.from(files).find((f) => f.type.startsWith("image/"));
//       if (fileToOpen) {
//         // TODO: Futuramente, você pode criar um novo projeto com as
//         // dimensões da imagem. Por enquanto, vamos apenas avisar.
//         alert(
//           "Para abrir uma imagem como um novo projeto, use o botão 'Open Image' ou crie um projeto primeiro."
//         );
//         // ou, se preferir, crie um projeto com ela:
//         // window.Engine.loadImage(fileToOpen.path); // (Isso não vai funcionar bem na home)
//       }
//     }
//   }
//   // Se estivermos em um projeto ativo, adicione arquivos como novas camadas
//   else {
//     const activeProject = getActiveProject();
//     if (!activeProject) return;

//     for (const file of files) {
//       if (file.type.startsWith("image/")) {
//         // Lógica existente: Adiciona como camada
//         const center = window.Engine.screenToProject(
//           mainCanvas.width / 2,
//           mainCanvas.height / 2
//         );
//         window.Engine.createLayerFromBlob(file, center, true);
//       } else if (file.name.endsWith(".ocfd")) {
//         // Futuro: Lógica da Smart Layer que você mencionou
//         alert("Arraste na barra de abas para abrir como projeto.");
//       }
//     }
//   }
// });

// // --- NOVO: Listener de Drop na BARRA DE ABAS ---
// // (Como você mencionou que queria isso no futuro)
// projectsTabs.addEventListener("dragover", (e) => {
//   e.preventDefault();
//   e.stopPropagation();
//   // Feedback visual
//   projectsTabs.classList.add("drag-over");
// });

// projectsTabs.addEventListener("dragleave", (e) => {
//   e.preventDefault();
//   e.stopPropagation();
//   projectsTabs.classList.remove("drag-over");
// });

// projectsTabs.addEventListener("drop", async (e) => {
//   e.preventDefault();
//   e.stopPropagation();
//   projectsTabs.classList.remove("drag-over");

//   const files = e.dataTransfer.files;
//   if (files.length > 0) {
//     for (const file of files) {
//       if (file.name.endsWith(".ocfd")) {
//         // É um projeto, vamos abri-lo
//         try {
//           // --- CORREÇÃO ---
//           // O renderer pode ler o conteúdo do arquivo arrastado diretamente.
//           const fileContent = await file.text();
//           // --- FIM DA CORREÇÃO ---

//           const projectData = JSON.parse(fileContent);
//           if (!projectData.name) {
//             projectData.name = getProjectNameFromPath(file.name);
//           }
//           // --- INÍCIO DA MODIFICAÇÃO ---
//           // Arquivos arrastados não têm um caminho completo (por segurança).
//           // Eles serão abertos, mas precisarão de "Salvar Como" na primeira vez.
//           await createProjectFromData(projectData);
//           // --- FIM DA MODIFICAÇÃO ---
//         } catch (err) {
//           console.error("Erro ao ler ou processar o arquivo:", err);
//           alert("Erro: Arquivo de projeto corrompido ou ilegível.");
//         }
//         break; // Abre apenas o primeiro arquivo .ocfd encontrado
//       }
//     }
//   }
// });

// --- INÍCIO DA NOVA SOLUÇÃO: OUVIR OS EVENTOS DO PRELOAD ---

// --- INÍCIO DA MODIFICAÇÃO ---
// Listener para mostrar o feedback visual nas ABAS
window.addEventListener("drag-over-tabs", () => {
  projectsTabs.classList.add("drag-over");
  canvasContainer.classList.remove("drag-over");
});

// Listener para mostrar o feedback visual no CANVAS
window.addEventListener("drag-over-canvas", () => {
  canvasContainer.classList.add("drag-over");
  projectsTabs.classList.remove("drag-over");
});

// (Substitui o antigo listener "drag-started")
// --- FIM DA MODIFICAÇÃO ---

// Listener para limpar o feedback visual
window.addEventListener("drag-ended", () => {
  canvasContainer.classList.remove("drag-over");
  projectsTabs.classList.remove("drag-over");
});

// Listener principal que recebe o arquivo
window.addEventListener("project-dropped", async (e) => {
  const { detail } = e; // detail contém { filePath, content, name }

  // Limpa o feedback visual
  canvasContainer.classList.remove("drag-over");
  projectsTabs.classList.remove("drag-over");

  if (!detail || !detail.content) {
    alert("Erro: Não foi possível ler o arquivo arrastado.");
    return;
  }

  // --- INÍCIO DA MODIFICAÇÃO ---
  // Lógica de Roteamento baseada no Alvo (Target)
  const activeProject = getActiveProject();

  if (
    detail.target === "tabs" ||
    (detail.target === "canvas" && !activeProject)
  ) {
    // Se soltar nas abas (sempre abre)
    // OU Se soltar no canvas E NÃO HÁ projeto ativo (trata como "abrir")
    try {
      const projectData = JSON.parse(detail.content);
      if (!projectData.name) {
        projectData.name = getProjectNameFromPath(detail.name);
      }
      await createProjectFromData(projectData, detail.filePath);
    } catch (err) {
      console.error("Erro ao processar o projeto (abrir):", err);
      alert("Erro: Arquivo de projeto corrompido ou ilegível.");
    }
  } else if (detail.target === "canvas" && activeProject) {
    // Se soltar no canvas E HÁ um projeto ativo (Smart Layer)

    // TODO: Lógica da Smart Layer
    console.log(
      "Arquivo .ocfd solto no canvas (Smart Layer):",
      detail.name,
      detail.filePath
    );
    alert("Importar como Smart Layer (ainda não implementado).");

    // Futuramente, você chamaria algo como:
    // await importAsSmartLayer(detail.filePath, detail.content);
  } else {
    // Soltou em outro lugar (ex: painel lateral)
    console.warn("Arquivo solto em local não tratado:", detail.target);
  }
  // --- FIM DA MODIFICAÇÃO ---
});

// --- FIM DA NOVA SOLUÇÃO ---

// Initialize UI
document.getElementById("moveTool").click();
updateSelectedToolUI();
