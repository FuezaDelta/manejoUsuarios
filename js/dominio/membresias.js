/**
 * Reglas de negocio de las membresías. Es el único lugar donde se decide
 * cuándo vence una membresía y cuándo está activa; antes esta lógica estaba
 * copiada en el alta de usuario, en el registro de pago y en la importación.
 */
import { diferenciaEnDias, esFechaValida, hoyLocal, sumarDias } from "./fechas.js";

export const ESTADO = {
  ACTIVA: "activa",
  VENCIDA: "vencida",
};

export const ETIQUETA_ESTADO = {
  [ESTADO.ACTIVA]: "Activa",
  [ESTADO.VENCIDA]: "Vencida",
};

/** Ventana de aviso del panel de inicio. */
export const DIAS_AVISO_VENCIMIENTO = 7;

/**
 * Fecha de vencimiento de una membresía.
 *
 * El día de inicio cuenta como día 1, por eso se resta uno: un plan de 30 días
 * que empieza el 1 de marzo vence el 30, no el 31.
 *
 * Falla de forma explícita si la duración no es válida. Antes se usaba un
 * valor por defecto de 30 días que convertía un plan mal configurado en un
 * vencimiento silenciosamente incorrecto.
 */
export function calcularFinMembresia(fechaInicio, duracionDias) {
  if (!esFechaValida(fechaInicio)) {
    throw new TypeError("calcularFinMembresia: la fecha de inicio no es válida.");
  }
  if (!Number.isInteger(duracionDias) || duracionDias < 1) {
    throw new RangeError(
      `calcularFinMembresia: duración inválida (${duracionDias}). Revisa el plan en Firestore.`
    );
  }
  return sumarDias(fechaInicio, duracionDias - 1);
}

/**
 * Días que faltan para que venza la membresía. Negativo si ya venció, 0 si
 * vence hoy, y null si el usuario no tiene fecha de vencimiento.
 */
export function diasParaVencer(fechaFin, hoy = hoyLocal()) {
  if (!esFechaValida(fechaFin)) return null;
  return diferenciaEnDias(hoy, fechaFin);
}

/**
 * Estado de la membresía, siempre derivado de la fecha de vencimiento.
 *
 * No se guarda en Firestore a propósito: un estado persistido queda obsoleto
 * al día siguiente de escribirlo si nadie lo recalcula, y aquí no hay ningún
 * proceso de servidor que lo haga.
 */
export function estadoMembresia(fechaFin, hoy = hoyLocal()) {
  const dias = diasParaVencer(fechaFin, hoy);
  return dias !== null && dias >= 0 ? ESTADO.ACTIVA : ESTADO.VENCIDA;
}

export function estaActiva(fechaFin, hoy = hoyLocal()) {
  return estadoMembresia(fechaFin, hoy) === ESTADO.ACTIVA;
}

/** Incluye el último día de la ventana: con 7 días, una membresía que vence en 7 cuenta. */
export function venceEnLosProximos(fechaFin, dias = DIAS_AVISO_VENCIMIENTO, hoy = hoyLocal()) {
  const restantes = diasParaVencer(fechaFin, hoy);
  return restantes !== null && restantes >= 0 && restantes <= dias;
}

/**
 * Reparte los usuarios en los grupos que muestra el panel de inicio.
 * Los usuarios sin fecha de vencimiento cuentan como vencidos, igual que en
 * el listado, para que el contador y la lista nunca se contradigan.
 */
export function clasificarUsuarios(usuarios, hoy = hoyLocal()) {
  const activos = [];
  const vencidos = [];
  const proximosAVencer = [];

  for (const usuario of usuarios) {
    if (estaActiva(usuario.fechaFinMembresia, hoy)) {
      activos.push(usuario);
      if (venceEnLosProximos(usuario.fechaFinMembresia, DIAS_AVISO_VENCIMIENTO, hoy)) {
        proximosAVencer.push(usuario);
      }
    } else {
      vencidos.push(usuario);
    }
  }

  const porVencimiento = (a, b) =>
    (a.fechaFinMembresia?.getTime() ?? 0) - (b.fechaFinMembresia?.getTime() ?? 0);
  proximosAVencer.sort(porVencimiento);
  vencidos.sort(porVencimiento);

  return { activos, vencidos, proximosAVencer };
}
