// renderer/app.js

// const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

// NOVO: Variável para guardar a escolha do usuário para a ferramenta de seleção
let lastUserSelectMode = "replace";

const btnAddEmptyLayer = document.getElementById("btnAddEmptyLayer");
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
      <button id="btnCancelTransform">Cancel</button>
      <button id="btnApplyTransform" style="background: var(--accent-color); color: white;">Apply</button>
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

function getActiveProject() {
  const activeTab = projectsTabs.querySelector("button.active:not(#homeTab)");
  if (!activeTab) return null;
  // O ID do projeto é armazenado como o ID do botão
  return projects.find((p) => p.id == activeTab.id);
}

// --- NOVO: FUNÇÃO PARA FECHAR PROJETO ---
function closeProject(projectId) {
  const projectIndex = projects.findIndex((p) => p.id == projectId);
  if (projectIndex === -1) return;

  const project = projects[projectIndex];

  // Use native confirm dialog
  if (
    !confirm(
      `Are you sure you want to close "${project.name}"? Unsaved changes will be lost.`
    )
  ) {
    return;
  }

  const tabToClose = document.getElementById(projectId);
  const wasActive = tabToClose.classList.contains("active");

  let nextActiveTab = null;
  if (wasActive) {
    // Try to activate the tab to the right
    nextActiveTab = tabToClose.nextElementSibling;
    // If there's no tab to the right, try the one to the left
    if (!nextActiveTab) {
      nextActiveTab = tabToClose.previousElementSibling;
    }
  }

  // Remove project from array and tab from DOM
  projects.splice(projectIndex, 1);
  tabToClose.remove();

  if (wasActive) {
    if (nextActiveTab) {
      // This will either be another project tab or the home tab
      nextActiveTab.click();
    } else {
      // Fallback to home tab if no other tabs exist
      homeTab.click();
    }
  }
}

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
  tabTitle.textContent = projectName;
  tab.appendChild(tabTitle);

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕"; // Using times symbol for 'x'
  closeBtn.className = "close-tab-btn";
  closeBtn.title = "Close Project";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Don't trigger tab switch
    closeProject(projectId);
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
        proj.selectionBounds // <-- CORREÇÃO: Mude de proj.selectionOffset para proj.selectionBounds
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
    width: w,
    height: h,
    layers: initialState.layers, // Camadas iniciais (ex: fundo)
    scale: initialState.scale,
    originX: initialState.originX,
    originY: initialState.originY,
    selectionDataURL: initialState.selectionDataURL,
    // CORREÇÃO: Usar selectionBounds
    selectionBounds: initialState.selectionBounds,
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

  const activeToolId = window.Engine.getActiveToolId();
  const toolState = window.Engine.getToolState(activeToolId);
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
    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");
    window.Engine.setActiveTool(btn.id);
    updateSelectedToolUI();
    mainCanvas.style.cursor = ""; // Reset cursor on tool change

    // A CORREÇÃO: Força a atualização da pré-visualização
    // Se o clique foi programático (via atalho), usa o último evento de mouse conhecido
    if (lastMouseEvent) {
      updateBrushPreview(lastMouseEvent);
    }
  });
});

// Add empty layer button handler
btnAddEmptyLayer.addEventListener("click", () => {
  const activeProject = getActiveProject();
  if (!activeProject) {
    alert("Create a project first");
    return;
  }
  window.Engine.createEmptyLayer();
});

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

  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case "v":
        document.getElementById("moveTool").click();
        break;
      case "m":
        document.getElementById("selectTool").click();
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
      case "s":
        e.preventDefault();
        btnSave.click();
        break;
      case "w":
        e.preventDefault();
        const activeProject = getActiveProject();
        // fechar projeto ativo
        if (activeProject) {
          closeProject(activeProject.id);
        }
        // else, se estiver na home tab, fechar o app
        else {
          window.close(); // Fecha a janela atual
        }
        break;
      case "z":
        e.preventDefault();
        if (window.Engine.isTransforming()) return; // Não faz undo/redo durante transformação
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

/**
 * --- NOVO: LÓGICA DE ARRASTAR E SOLTAR (DRAG & DROP) ---
 */
canvasContainer.addEventListener("dragover", (e) => {
  e.preventDefault(); // MUITO IMPORTANTE: Prevenir o comportamento padrão para permitir o drop.
  e.stopPropagation();
  // Verificar se há arquivos sendo arrastados
  if (e.dataTransfer.items) {
    const hasFiles = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === "file"
    );
    if (!hasFiles) return; // Se não houver arquivos, não faz nada
  }
  // Verificar se há um projeto ativo
  const activeProject = getActiveProject();
  if (!activeProject) return; // Se não houver projeto, não faz nada
  // Opcional: Adicionar um feedback visual, como uma borda
  // canvasContainer.style.outline = "2px dashed var(--accent-color)";
  canvasContainer.classList.add("drag-over");
});

canvasContainer.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  // Remove o feedback visual
  // canvasContainer.style.outline = "none";
  canvasContainer.classList.remove("drag-over");
});

canvasContainer.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  // canvasContainer.style.outline = "none"; // Limpa o feedback visual
  canvasContainer.classList.remove("drag-over");

  // Verificar se há um projeto ativo
  const activeProject = getActiveProject();
  if (!activeProject) return; // Se não houver projeto, não faz nada

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    for (const file of files) {
      // Checa se é um tipo de imagem suportado
      if (file.type.startsWith("image/")) {
        // Usa a mesma lógica do paste externo: calcula o centro e cria a camada

        // CORREÇÃO AQUI: Renomeado para window.Engine
        const center = window.Engine.screenToProject(
          mainCanvas.width / 2,
          mainCanvas.height / 2
        );
        window.Engine.createLayerFromBlob(file, center, true);
      }
    }
  }
});

// Initialize UI
document.getElementById("moveTool").click();
updateSelectedToolUI();
