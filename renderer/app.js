// renderer/app.js

const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

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
  // --- NOVO: Salvar estado do projeto anterior ---
  const currentProject = getActiveProject();
  if (currentProject) {
    // Pega o estado atual da ImageEngine
    const state = window.ImageEngine.getState();
    // Salva as layers no objeto do projeto
    currentProject.layers = state.layers;
    console.log(
      "Salvando layers do projeto '",
      currentProject.name,
      "' antes de ir para Home:",
      state.layers
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
    // chama a engine para criar o novo projeto
    window.ImageEngine.createNewProject(w, h);

    // registrar aba
    const tab = document.createElement("button");
    // this.tab = tab;
    tab.textContent =
      document.getElementById("ocf-proj-name").value || "Untitled";
    tab.id = Date.now();
    projectsTabs.querySelectorAll("button").forEach((b) => {
      b.classList.remove("active");
    });
    tab.classList.add("active");

    // ao clicar na aba, trocar para o projeto
    tab.addEventListener("click", () => {
      // --- NOVO: Salvar estado do projeto anterior ---
      const currentProject = getActiveProject();
      if (currentProject) {
        const state = window.ImageEngine.getState();
        currentProject.layers = state.layers;
        console.log(
          "Salvando layers do projeto '",
          currentProject.name,
          "' antes de trocar:",
          state.layers
        );
      }
      // ---------------------------------------------

      const proj = projects.find((p) => p.id == tab.id);
      console.log("Switching to project:", proj); // Log agora é único e correto
      if (proj) {
        window.ImageEngine.setProject(proj.width, proj.height, proj.layers);
        projectsTabs.querySelectorAll("button").forEach((b) => {
          b.classList.remove("active");
        });
        tab.classList.add("active");
        document.getElementById("zoomScale").style.display = "block";
      }
    });

    projectsTabs.appendChild(tab);

    projects.push({
      id: Date.now(),
      name: tab.textContent,
      width: w,
      height: h,
      layers: [],
    });

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
  const dataURL = window.ImageEngine.exportImage();
  const defaultName = "opencreate_export.png";
  const result = await window.electronAPI.saveFile({ dataURL, defaultName });
  if (result && result.success) {
    alert("Imagem salva em: " + result.filePath);
  } else if (result && result.error) {
    console.warn("Erro ao salvar:", result.error);
  }
});

// Filter grayscale (usa a função global applyFilter se existir)
btnGrayscale.addEventListener("click", () => {
  if (typeof applyFilter === "function") {
    applyFilter(window.Filters.grayscale);
  } else {
    alert("Filtro não implementado (applyFilter ausente)");
  }
});

// tool buttons: toggle active attr
toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");
  });
});
