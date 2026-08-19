/**
 * Construcción de HTML con escapado automático.
 *
 * Todas las plantillas de la app se escriben con la etiqueta `html`, que escapa
 * cada valor interpolado. Antes se concatenaba `innerHTML` con nombres, correos
 * y teléfonos sin escapar, así que un socio llamado `<img onerror=...>` —muy
 * fácil de colar por el CSV— ejecutaba código en la página.
 *
 * Para insertar HTML ya construido se anidan plantillas `html` o se pasan
 * arrays de ellas; cualquier otro valor se escapa.
 */

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

class HtmlSeguro {
  constructor(valor) {
    this.valor = valor;
  }

  toString() {
    return this.valor;
  }
}

export function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);
}

function serializar(valor) {
  if (valor instanceof HtmlSeguro) return valor.valor;
  if (Array.isArray(valor)) return valor.map(serializar).join("");
  // `false`, null y undefined permiten condicionales del tipo `${cond && html`...`}`.
  if (valor === null || valor === undefined || valor === false) return "";
  return escapar(valor);
}

export function html(partes, ...valores) {
  let salida = partes[0];
  for (let i = 0; i < valores.length; i += 1) {
    salida += serializar(valores[i]) + partes[i + 1];
  }
  return new HtmlSeguro(salida);
}

/**
 * Marca como seguro un HTML fijo escrito en el código. Es la única vía de
 * escape del escapado automático y solo debe usarse con literales del proyecto,
 * nunca con datos que vengan de Firestore o de un archivo.
 */
export function crudo(marca) {
  return new HtmlSeguro(marca);
}

/**
 * Vuelca una plantilla en un elemento. Único punto donde se asigna `innerHTML`.
 * Acepta plantillas `html`, arrays de plantillas y valores sueltos (que se
 * escapan).
 */
export function pintar(elemento, contenido) {
  elemento.innerHTML = serializar(contenido);
}
