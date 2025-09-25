// renderer/components.js

// Definição do Web Component
class SvgSrc extends HTMLElement {
  static get observedAttributes() {
    return ["src"];
  }

  constructor() {
    super();
    this._svgElement = null;
  }

  connectedCallback() {
    this.load();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "src" && oldValue !== newValue) {
      this.load();
    }
  }

  async load() {
    const src = this.getAttribute("src");
    if (!src) return;

    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(`SVG not found: ${resp.status}`);
      const svgText = await resp.text();

      // Parse o SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, "image/svg+xml");
      const svgNode = doc.querySelector("svg");
      if (!svgNode) {
        console.error("Arquivo SVG não contém elemento <svg>");
        return;
      }

      // Opcional: limpe atributos width/height para responsivo ou preserva estilos
      // Por exemplo, copie viewBox se necessário
      // Se você quiser permitir estilização com currentColor, pode configurar fill/stroke para 'currentColor'

      // Limpar conteúdo antigo
      this.innerHTML = "";
      // Inserir o conteúdo do SVG inline
      this.appendChild(svgNode);

      this._svgElement = svgNode;

      // Se quiser propagar atributos como class/style do <svg-src> para o SVG interno:
      // isso ajuda a aplicar estilos via CSS
      if (this.hasAttribute("class")) {
        svgNode.setAttribute("class", this.getAttribute("class"));
      }
      if (this.hasAttribute("width")) {
        svgNode.setAttribute("width", this.getAttribute("width"));
      }
      if (this.hasAttribute("height")) {
        svgNode.setAttribute("height", this.getAttribute("height"));
      }

      // Example: permitir setar fill via atributo ou estilo no componente
      // se atributo "fill" existir no <svg-src>, propagar
      if (this.hasAttribute("fill")) {
        svgNode.setAttribute("fill", this.getAttribute("fill"));
      }
      if (this.hasAttribute("stroke")) {
        svgNode.setAttribute("stroke", this.getAttribute("stroke"));
      }
    } catch (err) {
      console.error("Erro carregando SVG:", err);
    }
  }

  get svg() {
    return this._svgElement;
  }
}

// Registrar o componente se ainda não estiver registrado
if (!customElements.get("svg-src")) {
  customElements.define("svg-src", SvgSrc);
}
