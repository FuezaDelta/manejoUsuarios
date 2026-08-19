import { collection, db, doc, getDocs, query, Timestamp, where } from "../firebase/cliente.js";

const COLECCION_PAGOS = "pagos";

export const ORIGEN_PAGO = {
  /** Cobro registrado desde un formulario de la app. */
  MANUAL: "manual",
  /**
   * Membresía traída de una importación CSV. Se guarda con monto 0 para no
   * inventar ingresos, pero se guarda: así toda fecha de vencimiento tiene un
   * registro que la justifica y el borrado en cascada sigue funcionando.
   */
  IMPORTACION: "importacion",
};

export function nuevaReferenciaDePago() {
  return doc(collection(db, COLECCION_PAGOS));
}

export function documentoDePago({
  usuarioId,
  plan,
  montoPagado,
  metodoPago,
  fechaPago,
  fechaFin,
  origen = ORIGEN_PAGO.MANUAL,
}) {
  return {
    usuarioId,
    planId: plan.id,
    montoPagado,
    metodoPago,
    fechaPago: Timestamp.fromDate(fechaPago),
    fechaInicio: Timestamp.fromDate(fechaPago),
    fechaFin: Timestamp.fromDate(fechaFin),
    origen,
    creadoEn: Timestamp.now(),
  };
}

/** Referencias de todos los pagos de un usuario, para el borrado en cascada. */
export async function referenciasDePagosDe(usuarioId) {
  const consulta = query(collection(db, COLECCION_PAGOS), where("usuarioId", "==", usuarioId));
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map((documento) => documento.ref);
}
