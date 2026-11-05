import { collection, db, doc, getDocs, onSnapshot, query, Timestamp, where } from "../firebase/cliente.js";

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

function aFecha(valor) {
  return valor && typeof valor.toDate === "function" ? valor.toDate() : null;
}

function aPago(documento) {
  const datos = documento.data();
  return {
    id: documento.id,
    usuarioId: datos.usuarioId ?? "",
    planId: datos.planId ?? "",
    montoPagado: Number(datos.montoPagado) || 0,
    metodoPago: datos.metodoPago || "Sin definir",
    fechaPago: aFecha(datos.fechaPago),
    origen: datos.origen ?? ORIGEN_PAGO.MANUAL,
  };
}

/**
 * Escucha los pagos en tiempo real para el Dashboard. Los registros de
 * importación (monto 0, sin cobro real) se excluyen: no son ingresos y
 * distorsionarían el ticket promedio, los métodos de pago y los planes vendidos.
 */
export function escucharPagos(alRecibir, alFallar) {
  return onSnapshot(
    collection(db, COLECCION_PAGOS),
    (snapshot) => {
      const pagos = snapshot.docs
        .map(aPago)
        .filter((pago) => pago.origen !== ORIGEN_PAGO.IMPORTACION);
      alRecibir(pagos);
    },
    alFallar
  );
}

/** Referencias de todos los pagos de un usuario, para el borrado en cascada. */
export async function referenciasDePagosDe(usuarioId) {
  const consulta = query(collection(db, COLECCION_PAGOS), where("usuarioId", "==", usuarioId));
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map((documento) => documento.ref);
}
