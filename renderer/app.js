// renderer/app.js

const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");

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
      <h3 style="margin:0 0 8px 0">New Project</h3>
      <label style="display:block;margin-bottom:6px">
        Width: <input id="ocf-proj-width" type="number" value="800" min="1" style="width:100px;margin-left:6px" />
      </label>
      <label style="display:block;margin-bottom:12px">
        Height: <input id="ocf-proj-height" type="number" value="600" min="1" style="width:100px;margin-left:6px" />
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
    modal.remove();
  });
}

// New Project button
btnNew.addEventListener("click", () => {
  showNewProjectModal();
});

// Open file (usa API exposta via preload)
btnOpen.addEventListener("click", async () => {
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
