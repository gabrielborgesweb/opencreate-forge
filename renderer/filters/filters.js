// exemplo simples de filtro
function grayscaleFilter(r, g, b, a) {
  const avg = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [avg, avg, avg, a];
}

function invertFilter(r, g, b, a) {
  return [255 - r, 255 - g, 255 - b, a];
}

// exporta globalmente para app.js
window.Filters = {
  grayscale: grayscaleFilter,
  invert: invertFilter,
  // mais filtros...
};
