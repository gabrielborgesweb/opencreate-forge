const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (data) => ipcRenderer.invoke("dialog:saveFile", data),
  // --- INÍCIO DA MODIFICAÇÃO ---
  // Renomeado
  saveProjectAs: (data) => ipcRenderer.invoke("dialog:saveProjectAs", data),
  // Novo
  saveProject: (data) => ipcRenderer.invoke("fs:saveProject", data),
  // Novo
  confirmClose: (projectName) =>
    ipcRenderer.invoke("dialog:confirmClose", projectName),
  // --- FIM DA MODIFICAÇÃO ---
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  // readFile: (filePath) => ipcRenderer.invoke("fs:readFile", filePath),
});

// --- INÍCIO DA NOVA SOLUÇÃO (BASEADA NA SUA IDEIA) ---

/**
 * Lê o conteúdo de um objeto File (que vem do drop)
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.error);
    reader.readAsText(file); // Lê como texto (para o JSON .ocfd)
  });
}

// 1. Adiciona o listener quando o DOM estiver pronto
window.addEventListener("DOMContentLoaded", () => {
  // 2. Ouve eventos de drop no corpo inteiro do documento
  document.body.addEventListener(
    "drop",
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Envia um evento para o app.js limpar o feedback visual
      window.dispatchEvent(new CustomEvent("drag-ended"));

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      // Prioriza arquivos .ocfd
      const file = Array.from(files).find((f) => f.name.endsWith(".ocfd"));

      if (file) {
        // *** A SUA SOLUÇÃO APLICADA ***
        // No contexto do preload, podemos usar webUtils
        let filePath = null;
        try {
          // Esta é a função que você encontrou!
          filePath = webUtils.getPathForFile(file);
        } catch (err) {
          console.error("PRELOAD SCRIPT: webUtils.getPathForFile falhou.", err);
          filePath = null; // Continua sem o caminho
        }
        // *** FIM DA APLICAÇÃO ***

        if (!filePath) {
          console.warn(
            "PRELOAD SCRIPT: Não foi possível obter o file.path via webUtils."
          );
        }

        // --- INÍCIO DA MODIFICAÇÃO ---
        // Determina ONDE o drop ocorreu
        const dropTarget = projectsTabs.contains(e.target)
          ? "tabs"
          : canvasContainer.contains(e.target)
          ? "canvas"
          : "unknown";
        // --- FIM DA MODIFICAÇÃO ---

        // Lê o conteúdo do arquivo e envia tudo para o app.js
        try {
          const content = await readFileContent(file);

          // 3. Dispara um evento customizado que o app.js pode ouvir
          window.dispatchEvent(
            new CustomEvent("project-dropped", {
              detail: {
                filePath: filePath, // O caminho real (ou null)
                content: content,
                name: file.name,
                target: dropTarget, // <-- NOVO: Informa onde o drop aconteceu
              },
            })
          );
        } catch (err) {
          console.error("Erro ao ler arquivo no preload:", err);
        }
      }
      // TODO: Lidar com 'drop' de imagens (files[0].type.startsWith("image/"))
      // Você pode adicionar um 'else if' aqui e disparar um evento
      // 'image-dropped' com o file.path e o tipo.
    },
    true
  ); // Use 'capture' para pegar o evento primeiro

  // 4. Prevenir o comportamento padrão do 'dragover' é essencial
  document.body.addEventListener(
    "dragover",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Envia um evento para o app.js mostrar o feedback visual
      // --- INÍCIO DA MODIFICAÇÃO ---
      // Lógica de feedback visual isolado
      if (projectsTabs && projectsTabs.contains(e.target)) {
        // Está sobre as abas
        window.dispatchEvent(new CustomEvent("drag-over-tabs"));
      } else if (canvasContainer && canvasContainer.contains(e.target)) {
        // Está sobre o canvas
        window.dispatchEvent(new CustomEvent("drag-over-canvas"));
      } else {
        // Está sobre qualquer outra coisa (limpa os destaques)
        window.dispatchEvent(new CustomEvent("drag-ended"));
      }
      // REMOVE a linha antiga: window.dispatchEvent(new CustomEvent("drag-started"));
      // --- FIM DA MODIFICAÇÃO ---
    },
    true
  );

  // 5. Limpa o feedback visual se o mouse sair
  document.body.addEventListener(
    "dragleave",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Envia um evento para o app.js limpar o feedback visual
      window.dispatchEvent(new CustomEvent("drag-ended"));
    },
    true
  );
});
// --- FIM DA NOVA SOLUÇÃO ---
