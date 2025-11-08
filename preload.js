// preload.js

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
      if (window.isLayerDragging) {
        return;
      }

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
    false // <-- MUDANÇA CRUCIAL: de 'true' para 'false'
  ); // Use 'capture' para pegar o evento primeiro

  // 4. Prevenir o comportamento padrão do 'dragover' é essencial
  // --- INÍCIO DA CORREÇÃO ---
  // Esta é a única função que precisa ser alterada.
  document.body.addEventListener(
    "dragover",
    (e) => {
      // 1. CHAME PREVENTDEFAULT() IMEDIATAMENTE.
      // Isso sinaliza ao navegador que um drop é permitido,
      // permitindo que o evento continue a propagar.
      e.preventDefault();

      // 2. Verifique a flag.
      if (window.isLayerDragging) {
        // É um arraste de camada. Apenas retorne e deixe
        // o `div.ondragover` do engineRenderer lidar com o evento.
        return true;
      }

      // 3. Se NÃO for um arraste de camada, é um ARQUIVO.
      // Agora podemos parar a propagação (para não confundir o div)
      // e mostrar a UI de feedback de arquivo.
      e.stopPropagation();

      // Lógica de feedback visual (para arquivos)
      if (projectsTabs && projectsTabs.contains(e.target)) {
        window.dispatchEvent(new CustomEvent("drag-over-tabs"));
      } else if (canvasContainer && canvasContainer.contains(e.target)) {
        window.dispatchEvent(new CustomEvent("drag-over-canvas"));
      } else {
        window.dispatchEvent(new CustomEvent("drag-ended"));
      }
    },
    false // <-- MUDANÇA CRUCIAL: de 'true' para 'false'
  );
  // --- FIM DA CORREÇÃO ---

  // 5. Limpa o feedback visual se o mouse sair
  document.body.addEventListener(
    "dragleave",
    (e) => {
      if (window.isLayerDragging) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      // Envia um evento para o app.js limpar o feedback visual
      window.dispatchEvent(new CustomEvent("drag-ended"));
    },
    false // <-- MUDANÇA CRUCIAL: de 'true' para 'false'
  );
});
// --- FIM DA NOVA SOLUÇÃO ---
