/**
 * Validación de los datos que entran por formulario o por CSV. Devuelve
 * siempre la lista completa de errores en lugar de lanzar, para que quien
 * llame decida cómo mostrarlos.
 */
import { esFechaValida } from "./fechas.js";
import { soloDigitos } from "../utilidades/texto.js";

export const LARGO_TELEFONO = 10;
const MAX_LARGO_NOMBRE = 80;
const MAX_LARGO_EMAIL = 120;
const INDICATIVO_COLOMBIA = "57";

/** Comprobación deliberadamente laxa: descarta lo obviamente inválido sin rechazar direcciones legítimas. */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function error(campo, mensaje) {
  return { campo, mensaje };
}

/**
 * Deja el teléfono en 10 dígitos nacionales, aceptando que venga con
 * indicativo (+57), espacios o guiones. Devuelve "" si no es reconocible.
 */
export function normalizarTelefono(valor) {
  const digitos = soloDigitos(valor);
  if (digitos.length === LARGO_TELEFONO) return digitos;
  if (digitos.length === LARGO_TELEFONO + 2 && digitos.startsWith(INDICATIVO_COLOMBIA)) {
    return digitos.slice(2);
  }
  return "";
}

export function esEmailValido(valor) {
  const email = String(valor ?? "").trim();
  return email.length <= MAX_LARGO_EMAIL && PATRON_EMAIL.test(email);
}

/**
 * Valida y normaliza los datos personales de un usuario.
 * Devuelve `{ valido, errores, datos }`, con `datos` ya listo para guardar.
 */
export function validarUsuario(entrada) {
  const nombre = String(entrada.nombre ?? "").trim();
  const apellido = String(entrada.apellido ?? "").trim();
  const telefono = normalizarTelefono(entrada.telefono);
  const emailBruto = String(entrada.email ?? "").trim();

  const errores = [];
  if (!nombre) errores.push(error("nombre", "El nombre es obligatorio."));
  if (nombre.length > MAX_LARGO_NOMBRE) {
    errores.push(error("nombre", `El nombre no puede pasar de ${MAX_LARGO_NOMBRE} caracteres.`));
  }
  if (!apellido) errores.push(error("apellido", "El apellido es obligatorio."));
  if (apellido.length > MAX_LARGO_NOMBRE) {
    errores.push(error("apellido", `El apellido no puede pasar de ${MAX_LARGO_NOMBRE} caracteres.`));
  }
  if (!telefono) {
    errores.push(error("telefono", `El teléfono debe tener ${LARGO_TELEFONO} dígitos.`));
  }
  const emailValido = emailBruto ? esEmailValido(emailBruto) : true;
  if (!emailValido) {
    errores.push(error("email", "El email no tiene un formato válido."));
  }

  return {
    valido: errores.length === 0,
    errores,
    // `datos` siempre es seguro de guardar: un email con formato inválido se
    // descarta aquí, para que quien decida ignorar ese error (la importación
    // CSV) no acabe escribiéndolo en la base.
    datos: {
      nombre,
      apellido,
      telefono,
      email: emailValido && emailBruto ? emailBruto : null,
    },
  };
}

/**
 * Valida los datos de un pago. `plan` debe ser el plan ya resuelto desde el
 * estado de la aplicación, no un id suelto: así el monto y la duración nunca
 * se leen del DOM.
 */
export function validarPago({ plan, monto, metodoPago, fechaPago }) {
  const errores = [];

  if (!plan || !plan.id) {
    errores.push(error("plan", "Selecciona un plan."));
  } else if (!Number.isInteger(plan.duracionDias) || plan.duracionDias < 1) {
    errores.push(error("plan", `El plan "${plan.nombre}" no tiene una duración válida en Firestore.`));
  }

  const montoNumero = Number(monto);
  if (!Number.isFinite(montoNumero) || montoNumero < 0) {
    errores.push(error("monto", "El monto debe ser un número mayor o igual a cero."));
  }

  if (!esFechaValida(fechaPago)) {
    errores.push(error("fechaPago", "La fecha de pago no es válida."));
  }

  return {
    valido: errores.length === 0,
    errores,
    datos: {
      plan,
      montoPagado: Number.isFinite(montoNumero) ? montoNumero : 0,
      metodoPago: String(metodoPago ?? "").trim() || null,
      fechaPago,
    },
  };
}

const MAX_LARGO_PLAN = 60;
const MAX_PRECIO_PLAN = 100_000_000;
const MAX_DIAS_PLAN = 3650;

/**
 * Valida un plan del catálogo. `datos` queda listo para escribir en Firestore:
 * nombre recortado, precio numérico y duración en días enteros.
 */
export function validarPlan({ nombre, precio, duracionDias }) {
  const nombreLimpio = String(nombre ?? "").trim();
  const precioNumero = Number(precio);
  const duracionNumero = Number(duracionDias);
  const errores = [];

  if (!nombreLimpio) errores.push(error("nombre", "El nombre del plan es obligatorio."));
  if (nombreLimpio.length > MAX_LARGO_PLAN) {
    errores.push(error("nombre", `El nombre no puede pasar de ${MAX_LARGO_PLAN} caracteres.`));
  }

  if (!Number.isFinite(precioNumero) || precioNumero < 0) {
    errores.push(error("precio", "El precio debe ser un número mayor o igual a cero."));
  } else if (precioNumero > MAX_PRECIO_PLAN) {
    errores.push(error("precio", "El precio es demasiado alto."));
  }

  if (!Number.isInteger(duracionNumero) || duracionNumero < 1) {
    errores.push(error("duracionDias", "La duración debe ser un número entero de días mayor que cero."));
  } else if (duracionNumero > MAX_DIAS_PLAN) {
    errores.push(error("duracionDias", "La duración no puede pasar de 10 años."));
  }

  return {
    valido: errores.length === 0,
    errores,
    datos: {
      nombre: nombreLimpio,
      precio: Number.isFinite(precioNumero) ? precioNumero : 0,
      duracionDias: Number.isInteger(duracionNumero) ? duracionNumero : 0,
    },
  };
}

/** Une los errores en un solo texto para mostrarlo en el aviso de la sección. */
export function mensajeDeErrores(errores) {
  return errores.map((e) => e.mensaje).join(" ");
}
