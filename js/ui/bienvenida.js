/**
 * Pantalla de bienvenida que aparece unos segundos al iniciar sesión.
 *
 * Solo se muestra al entrar desde el formulario de login, no al recargar la
 * página con la sesión ya abierta: saludar en cada recarga cansa enseguida.
 * Se puede saltar con un clic o con cualquier tecla, y respeta la preferencia
 * del sistema de reducir animaciones.
 */
import { ETIQUETA_ROL } from "../dominio/roles.js";

const DURACION_MS = 5000;
const DURACION_REDUCIDA_MS = 1600;
const SALIDA_MS = 550;
const RETARDO_LETRA_MS = 38;

function saludoSegunHora(fecha = new Date()) {
  const hora = fecha.getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Cada letra va en su propio span para animarlas en cascada. */
function nombreAnimado(nombre) {
  const contenedor = crear("span", "bienvenida__nombre");
  contenedor.setAttribute("aria-label", nombre);
  [...nombre].forEach((caracter, indice) => {
    const letra = crear("span", "bienvenida__letra", caracter === " " ? " " : caracter);
    letra.setAttribute("aria-hidden", "true");
    letra.style.animationDelay = `${450 + indice * RETARDO_LETRA_MS}ms`;
    contenedor.append(letra);
  });
  return contenedor;
}

export function mostrarBienvenida(perfil) {
  document.querySelector(".bienvenida")?.remove();

  const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const duracion = reducido ? DURACION_REDUCIDA_MS : DURACION_MS;
  const nombre = (perfil.nombre || perfil.usuario || "").trim();
  const fecha = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  const capa = crear("div", "bienvenida");
  capa.setAttribute("role", "status");
  capa.setAttribute("aria-live", "polite");
  capa.style.setProperty("--bienvenida-duracion", `${duracion}ms`);

  const logo = crear("div", "bienvenida__logo");
  const imagen = crear("img");
  imagen.src = "assets/FD-Logo.jpeg";
  imagen.alt = "";
  imagen.addEventListener("error", () => imagen.remove());
  logo.append(crear("span", "bienvenida__onda"), crear("span", "bienvenida__onda bienvenida__onda--2"), imagen);

  const saludo = crear("p", "bienvenida__saludo", `${saludoSegunHora()},`);
  const rol = crear("span", "bienvenida__rol", ETIQUETA_ROL[perfil.rol] ?? "");
  const mensaje = crear("p", "bienvenida__mensaje", "Te damos la bienvenida a Fuerza Delta");
  const dia = crear("p", "bienvenida__fecha", fecha.charAt(0).toUpperCase() + fecha.slice(1));
  const barra = crear("div", "bienvenida__barra");
  barra.append(crear("span", "bienvenida__progreso"));
  const pista = crear("p", "bienvenida__pista", "Toca para continuar");

  const tarjeta = crear("div", "bienvenida__contenido");
  tarjeta.append(logo, saludo, nombreAnimado(nombre), rol, mensaje, dia, barra);
  capa.append(tarjeta, pista);
  document.body.append(capa);

  let cerrada = false;
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    clearTimeout(temporizador);
    document.removeEventListener("keydown", cerrar);
    capa.classList.add("bienvenida--saliendo");
    setTimeout(() => capa.remove(), SALIDA_MS);
  }

  const temporizador = setTimeout(cerrar, duracion);
  capa.addEventListener("click", cerrar);
  document.addEventListener("keydown", cerrar);
}
