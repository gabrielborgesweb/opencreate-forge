const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");
// const canvas = document.getElementById("mainCanvas");

// Assumindo que openFile devolve um caminho (ou base64) - depende da interface que você fizer
btnOpen.addEventListener("click", async () => {
  console.log("Botão de abrir clicado");
  const result = await window.electronAPI.openFile();
  console.log("Result do openFile:", result);
  if (result) {
    loadImage(result);
  }
});

btnSave.addEventListener("click", async () => {
  console.log("Botão Salvar clicado");

  // Obter imagem do canvas como dataURL (PNG por exemplo)
  const canvas = document.getElementById("mainCanvas");
  const dataURL = canvas.toDataURL("image/png");

  // Opcional: definir nome padrão
  const defaultName = "opencreate_image.png";

  const result = await window.electronAPI.saveFile({ dataURL, defaultName });
  console.log("Resultado do saveFile:", result);
  if (result.success) {
    alert("Imagem salva em: " + result.filePath);
  } else {
    console.warn("Falha ao salvar:", result.error);
  }
});

btnGrayscale.addEventListener("click", () => {
  applyFilter(window.Filters.grayscale);
});

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");
    console.log(`Ferramenta selecionada: ${btn.id}`);
    // Aqui você pode definir a ferramenta ativa no seu app
  });
});
