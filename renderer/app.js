const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
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

btnGrayscale.addEventListener("click", () => {
  applyFilter(window.Filters.grayscale);
});
