// renderer/app.js

const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

const btnAddEmptyLayer = document.getElementById("btnAddEmptyLayer");
const selectedToolDiv = document.getElementById("selectedtool");
// NOVO: Elemento de pré-visualização
const brushPreview = document.getElementById("brushPreview");
const canvasContainer = document.getElementById("canvasContainer");

// NOVO: Variável para armazenar o último evento do mouse
let lastMouseEvent = null;

const projects = [
  // { id, name, width, height, layers: [...] }
];
const projectsTabs = document.getElementById("projectsTabs");
const homeTab = document.getElementById("homeTab");

function getActiveProject() {
  const activeTab = projectsTabs.querySelector("button.active:not(#homeTab)");
  if (!activeTab) return null;
  // O ID do projeto é armazenado como o ID do botão
  return projects.find((p) => p.id == activeTab.id);
}

// set initial state
homeTab.classList.add("active");

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
  document.getElementById("zoomScale").style.display = "none";
});

// show modal for new project (programmatic simple modal)
function showNewProjectModal() {
  // evitar duplicar
  if (document.getElementById("ocf-new-project-modal")) return;

  const modal = document.createElement("div");
  modal.id = "ocf-new-project-modal";
  modal.style.position = "fixed";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.right = "0";
  modal.style.bottom = "0";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.45)";
  modal.style.zIndex = "9999";

  modal.innerHTML = `
    <div style="background:#222;color:#fff;padding:18px;border-radius:8px;min-width:260px;">
      <h3 style="margin:0 0 8px 0">Create New Project</h3>
      <label style="display:block;margin-bottom:6px">
        Name: <input id="ocf-proj-name" type="text" value="Untitled" min="1" style="width:100px;margin-left:6px" />
      </label>
      <label style="display:block;margin-bottom:6px">
        Width: <input id="ocf-proj-width" type="number" value="1080" min="1" style="width:100px;margin-left:6px" />
      </label>
      <label style="display:block;margin-bottom:12px">
        Height: <input id="ocf-proj-height" type="number" value="1080" min="1" style="width:100px;margin-left:6px" />
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="ocf-cancel" style="padding:6px 10px">Cancel</button>
        <button id="ocf-create" style="padding:6px 10px">Create</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("ocf-cancel").addEventListener("click", () => {
    modal.remove();
  });

  document.getElementById("ocf-create").addEventListener("click", () => {
    const w = parseInt(document.getElementById("ocf-proj-width").value, 10);
    const h = parseInt(document.getElementById("ocf-proj-height").value, 10);
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

    // registrar aba
    const tab = document.createElement("button");
    tab.textContent =
      document.getElementById("ocf-proj-name").value || "Untitled";
    tab.id = projectId;
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
      }
    });

    projectsTabs.appendChild(tab);

    // --- INICIALIZAR PROJETO COM O ESTADO ATUAL DO VIEWPORT ---
    // Pega o estado atual após o createNewProject (que chama fitToScreen)
    const initialState = window.ImageEngine.getState();

    projects.push({
      id: projectId,
      name: tab.textContent,
      width: w,
      height: h,
      layers: [],
      // Adicionar estado inicial do viewport
      scale: initialState.scale,
      originX: initialState.originX,
      originY: initialState.originY,
    });
    // --------------------------------------------------------

    // chama a engine para criar o novo projeto
    window.ImageEngine.createNewProject(w, h);

    document.getElementById("zoomScale").style.display = "block";

    modal.remove();
  });
}

// New Project button
btnNew.addEventListener("click", () => {
  showNewProjectModal();
});

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
  // abre dialog e retorna caminho do arquivo
  const result = await window.electronAPI.openFile();
  if (result) {
    // window.ImageEngine.loadImage adiciona como nova camada
    window.ImageEngine.loadImage(result);
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

  // Gera as opções de UI para ferramentas de desenho (pincel, borracha)
  if (activeToolId === "brushTool" || activeToolId === "eraserTool") {
    const sizeHTML = `
      <span style="margin-left: 10px">Size:</span>
      <input type="range" id="toolSize" min="1" max="2000" value="${toolState.size}">
      <span id="toolSizeValue">${toolState.size}px</span>
    `;

    const hardnessHTML = `
      <span style="margin-left: 10px">Hardness:</span>
      <input type="range" id="toolHardness" min="0" max="100" value="${Math.round(
        (toolState.hardness || 1.0) * 100
      )}">
      <span id="toolHardnessValue">${Math.round(
        (toolState.hardness || 1.0) * 100
      )}%</span>
    `;

    if (activeToolId === "brushTool") {
      const colorHTML = `<input type="color" id="toolColor" value="${toolState.color}" style="margin-left: 10px">`;
      toolOptionsHTML = colorHTML + sizeHTML + hardnessHTML;
    } else {
      toolOptionsHTML = sizeHTML + hardnessHTML;
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

  const engineState = window.ImageEngine.getState();
  const currentScale = engineState.scale;

  const hardness =
    typeof toolState.hardness === "number" ? toolState.hardness : 1.0;
  const effectiveSize = toolState.size * (1 + (1 - hardness) * 0.5);
  const previewSize = effectiveSize * currentScale;

  const rect = canvasContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  brushPreview.style.width = `${previewSize}px`;
  brushPreview.style.height = `${previewSize}px`;
  brushPreview.style.left = `${x}px`;
  brushPreview.style.top = `${y}px`;

  // Garante que a pré-visualização esteja visível se for uma ferramenta de desenho
  if (activeToolId === "brushTool" || activeToolId === "eraserTool") {
    brushPreview.style.display = "block";
  }
}

canvasContainer.addEventListener("mouseenter", (e) => {
  // Armazena o evento para o caso de um atalho de teclado ser usado
  lastMouseEvent = e;
  const activeToolId = window.ImageEngine.getActiveToolId();
  if (activeToolId === "brushTool" || activeToolId === "eraserTool") {
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
