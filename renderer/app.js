// renderer/app.js

// const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

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
  // { id, name, width, height, layers: [...] }
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
  if (typeof window.ImageEngine === "undefined") {
    alert("ImageEngine não está disponível");
    return;
  }

  // --- SALVAR ESTADO ANTES DE TROCAR PARA HOME ---
  const currentProject = getActiveProject();
  if (currentProject) {
    // Pega o estado atual da ImageEngine
    const state = window.ImageEngine.getState();
    // Salva as layers no objeto do projeto
    currentProject.layers = state.layers;
    // Salvar estado do viewport
    currentProject.scale = state.scale;
    currentProject.originX = state.originX;
    currentProject.originY = state.originY;
    console.log(
      "Salvando layers e viewport do projeto '",
      currentProject.name,
      "' antes de ir para Home:",
      state
    );
  }
  // ---------------------------------------------

  window.ImageEngine.resetViewport();
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
    const state = window.ImageEngine.getState();
    currentProject.layers = state.layers;
    // Salvar estado do viewport
    currentProject.scale = state.scale;
    currentProject.originX = state.originX;
    currentProject.originY = state.originY;
    console.log(
      "Salvando layers e viewport do projeto '",
      currentProject.name,
      "' antes de criar novo:",
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
    // --- SALVAR ESTADO ANTES DE TROCAR ---
    const currentProject = getActiveProject();
    if (currentProject) {
      const state = window.ImageEngine.getState();
      currentProject.layers = state.layers;
      // Salvar estado do viewport
      currentProject.scale = state.scale;
      currentProject.originX = state.originX;
      currentProject.originY = state.originY;
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
      window.ImageEngine.setProject(
        proj.width,
        proj.height,
        proj.layers,
        viewportState
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
  window.ImageEngine.createNewProject(w, h);

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
      window.ImageEngine.addFillLayer(color, "Background");
    }
  }
  // --------------------------------------------------

  // --- INICIALIZAR PROJETO COM O ESTADO ATUAL DO VIEWPORT ---
  // Pega o estado atual após o createNewProject (que chama fitToScreen)
  const initialState = window.ImageEngine.getState();

  projects.push({
    id: projectId,
    name: projectName,
    width: w,
    height: h,
    layers: [],
    // Adicionar estado inicial do viewport
    scale: initialState.scale,
    originX: initialState.originX,
    originY: initialState.originY,
  });
  // --------------------------------------------------------

  document.getElementById("zoomScale").style.display = "block";
  hideHomeScreen(); // Esconde a tela inicial
}

// New Project button
// btnNew.addEventListener("click", () => {
//   // Em vez de modal, apenas volta para a home tab
//   homeTab.click();
// });

// Open file (usa API exposta via preload)
btnOpen.addEventListener("click", async () => {
  if (typeof window.ImageEngine === "undefined") {
    alert("ImageEngine não está disponível");
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
      // window.ImageEngine.loadImage adiciona como nova camada
      window.ImageEngine.loadImage(result);
    }
  } catch (error) {
    console.error("Failed to open file:", error);
    alert("Failed to open file");
  }
});

// Save -> export via ImageEngine (exportImage) que retorna dataURL
btnSave.addEventListener("click", async () => {
  if (typeof window.ImageEngine === "undefined") {
    alert("ImageEngine não está disponível");
    return;
  }
  if (projects.length === 0) {
    alert("Crie um novo projeto antes de salvar uma imagem");
    return;
  }
  const dataURL = window.ImageEngine.exportImage();
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

// MODIFICADO: Modificar a função updateSelectedToolUI()
function updateSelectedToolUI() {
  const activeToolButton = document.querySelector(".tool-button[active]");
  if (!activeToolButton) {
    selectedToolDiv.innerHTML = "";
    return;
  }

  const activeToolId = activeToolButton.id;
  const toolState = window.ImageEngine.getToolState(activeToolId);
  const toolName = activeToolButton.getAttribute("title").split(" (")[0];

  let toolOptionsHTML = "";

  // Gera as opções de UI para ferramentas de desenho (pincel, lápis, borracha)
  if (
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool"
  ) {
    const sizeHTML = `
      <span style="margin-left: 10px">Size:</span>
      <input type="range" id="toolSize" min="1" max="200" value="${toolState.size}">
      <span id="toolSizeValue">${toolState.size}px</span>
    `;

    if (activeToolId === "brushTool") {
      const colorHTML = `<input type="color" id="toolColor" value="${toolState.color}" style="margin-left: 10px">`;
      const hardnessHTML = `
        <span style="margin-left: 10px">Hardness:</span>
        <input type="range" id="toolHardness" min="0" max="100" value="${Math.round(
          (toolState.hardness || 1.0) * 100
        )}">
        <span id="toolHardnessValue">${Math.round(
          (toolState.hardness || 1.0) * 100
        )}%</span>
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
        modeSpecificHTML = `
          <span style="margin-left: 10px">Hardness:</span>
          <input type="range" id="toolHardness" min="0" max="100" value="${Math.round(
            (toolState.hardness || 1.0) * 100
          )}">
          <span id="toolHardnessValue">${Math.round(
            (toolState.hardness || 1.0) * 100
          )}%</span>
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

  selectedToolDiv.innerHTML = `
    <span style="margin-left: 10px">${toolName}</span>
    ${toolOptionsHTML}
  `;

  // Adiciona listeners para as opções
  if (document.getElementById("toolColor")) {
    document.getElementById("toolColor").addEventListener("input", (e) => {
      window.ImageEngine.setToolOption(activeToolId, "color", e.target.value);
    });
  }

  if (document.getElementById("toolSize")) {
    document.getElementById("toolSize").addEventListener("input", (e) => {
      const size = parseInt(e.target.value, 10);
      window.ImageEngine.setToolOption(activeToolId, "size", size);
      document.getElementById("toolSizeValue").textContent = size + "px";
      // Atualiza a pré-visualização em tempo real
      if (lastMouseEvent) {
        updateBrushPreview(lastMouseEvent);
      }
    });
  }

  if (document.getElementById("toolHardness")) {
    document.getElementById("toolHardness").addEventListener("input", (e) => {
      const hardness = parseInt(e.target.value, 10) / 100;
      window.ImageEngine.setToolOption(activeToolId, "hardness", hardness);
      document.getElementById("toolHardnessValue").textContent = `${Math.round(
        hardness * 100
      )}%`;
      if (lastMouseEvent) {
        updateBrushPreview(lastMouseEvent);
      }
    });
  }

  if (document.getElementById("toolShape")) {
    document.getElementById("toolShape").addEventListener("change", (e) => {
      window.ImageEngine.setToolOption(activeToolId, "shape", e.target.value);
      if (lastMouseEvent) {
        updateBrushPreview(lastMouseEvent);
      }
    });
  }

  if (document.getElementById("toolMode")) {
    document.getElementById("toolMode").addEventListener("change", (e) => {
      window.ImageEngine.setToolOption(activeToolId, "mode", e.target.value);
      updateSelectedToolUI(); // Re-render options for the new mode
    });
  }
}

// Modify the tool buttons click handler
toolButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    // Recebe o evento 'e'
    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");
    window.ImageEngine.setActiveTool(btn.id);
    updateSelectedToolUI();

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
  window.ImageEngine.createEmptyLayer();
});

// MODIFICADO: Adicionar atalhos de teclado
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;

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
      // NOVO: Atalho para a ferramenta lápis
      case "n":
        document.getElementById("pencilTool").click();
        break;
      // NOVO: Atalho para a ferramenta borracha
      case "e":
        document.getElementById("eraserTool").click();
        break;
    }
  }

  // Common shortcuts
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
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
        if (e.shiftKey) {
          window.ImageEngine.redo();
        } else {
          window.ImageEngine.undo();
        }
        break;
    }
  }
});

// --- NOVO: LÓGICA DE PRÉ-VISUALIZAÇÃO DO PINCEL ---

function updateBrushPreview(e) {
  const activeToolId = window.ImageEngine.getActiveToolId();
  const toolState = window.ImageEngine.getToolState(activeToolId);

  if (!toolState || typeof toolState.size === "undefined") {
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

  const engineState = window.ImageEngine.getState();
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
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  // Snap preview to pixel grid for pencil tool
  if (isPencilMode) {
    if (window.ImageEngine.screenToProject) {
      const projectCoords = window.ImageEngine.screenToProject(x, y);
      const snappedProjectX = Math.floor(projectCoords.x);
      const snappedProjectY = Math.floor(projectCoords.y);

      const size = toolState.size;
      let centerX, centerY;

      if (size % 2 !== 0) {
        // Odd size: center of pixel
        centerX = snappedProjectX + 0.5;
        centerY = snappedProjectY + 0.5;
      } else {
        // Even size: top-left corner of pixel (matches drawing logic)
        centerX = snappedProjectX;
        centerY = snappedProjectY;
      }

      const screenCoords = window.ImageEngine.projectToScreen(centerX, centerY);
      x = screenCoords.x;
      y = screenCoords.y;
    }
  }

  brushPreview.style.width = `${previewSize}px`;
  brushPreview.style.height = `${previewSize}px`;
  brushPreview.style.left = `${x}px`;
  brushPreview.style.top = `${y}px`;

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
  const activeToolId = window.ImageEngine.getActiveToolId();
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
  updateBrushPreview(e);
});

// Initialize UI
document.getElementById("moveTool").click();
updateSelectedToolUI();
