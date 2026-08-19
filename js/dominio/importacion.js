/**
 * Interpretación de las filas de un CSV de usuarios. Es lógica pura: no toca
 * ni Firestore ni el DOM, así que se puede probar con tests.
 *
 * A diferencia de la versión anterior, ninguna fila se guarda a medias ni en
 * silencio: cada fila termina en uno de cuatro grupos (a crear, duplicada,
 * rechazada o con advertencia) y la vista informa del recuento.
 */
import { hoyLocal, parsearFechaFlexible } from "./fechas.js";
import { calcularFinMembresia } from "./membresias.js";
import { normalizarTelefono, validarUsuario } from "./validacion.js";
import { normalizarTexto } from "../utilidades/texto.js";

/** Nombres de columna aceptados para cada campo, ya normalizados. */
const ALIAS_COLUMNAS = {
  nombre: ["nombre", "nombres"],
  apellido: ["apellido", "apellidos"],
  telefono: ["telefono", "celular", "movil", "whatsapp"],
  email: ["email", "correo", "correoelectronico"],
  fechaRegistro: ["fecharegistro", "fecha", "fechainicio", "fechaingreso"],
  plan: ["plan", "membresia", "tipomembresia", "planid"],
};

function leerCampo(datos, campo) {
  for (const alias of ALIAS_COLUMNAS[campo]) {
    if (datos[alias]) return datos[alias];
  }
  return "";
}

/** Busca el plan por id o por nombre, ignorando mayúsculas y acentos. */
export function buscarPlan(planes, referencia) {
  const buscado = normalizarTexto(referencia);
  if (!buscado) return null;
  return (
    planes.find((plan) => normalizarTexto(plan.id) === buscado) ??
    planes.find((plan) => normalizarTexto(plan.nombre) === buscado) ??
    null
  );
}

/**
 * Prepara la importación a partir de las filas ya parseadas del CSV.
 *
 * El teléfono normalizado hace de clave natural: se descartan las filas cuyo
 * teléfono ya existe en la base o está repetido dentro del propio archivo, de
 * forma que volver a subir el mismo archivo no duplique a nadie.
 */
export function prepararImportacion({ filas, planes = [], usuariosExistentes = [], hoy = hoyLocal() }) {
  const telefonosVistos = new Set(
    usuariosExistentes.map((usuario) => normalizarTelefono(usuario.telefono)).filter(Boolean)
  );

  const aCrear = [];
  const duplicados = [];
  const rechazados = [];
  const advertencias = [];

  for (const { numero, datos } of filas) {
    const entrada = {
      nombre: leerCampo(datos, "nombre"),
      apellido: leerCampo(datos, "apellido"),
      telefono: leerCampo(datos, "telefono"),
      email: leerCampo(datos, "email"),
    };

    const validacion = validarUsuario(entrada);
    if (!validacion.valido) {
      // El email mal escrito no debe tumbar la fila: se guarda sin email.
      const erroresGraves = validacion.errores.filter((error) => error.campo !== "email");
      if (erroresGraves.length > 0) {
        rechazados.push({ numero, motivo: erroresGraves.map((e) => e.mensaje).join(" ") });
        continue;
      }
      advertencias.push({ numero, motivo: "Email inválido: se importó sin email." });
    }

    const usuario = validacion.datos;
    if (telefonosVistos.has(usuario.telefono)) {
      duplicados.push({ numero, motivo: `El teléfono ${usuario.telefono} ya existe.` });
      continue;
    }
    telefonosVistos.add(usuario.telefono);

    const registro = { numero, usuario, membresia: null };

    const fechaTexto = leerCampo(datos, "fechaRegistro");
    const fechaRegistro = fechaTexto ? parsearFechaFlexible(fechaTexto) : hoy;
    if (fechaTexto && !fechaRegistro) {
      advertencias.push({
        numero,
        motivo: `Fecha "${fechaTexto}" no reconocida: se usó la fecha de hoy.`,
      });
    }
    registro.fechaRegistro = fechaRegistro ?? hoy;

    const referenciaPlan = leerCampo(datos, "plan");
    if (referenciaPlan) {
      const plan = buscarPlan(planes, referenciaPlan);
      if (!plan) {
        advertencias.push({
          numero,
          motivo: `Plan "${referenciaPlan}" no existe: se importó sin membresía.`,
        });
      } else if (!Number.isInteger(plan.duracionDias) || plan.duracionDias < 1) {
        advertencias.push({
          numero,
          motivo: `El plan "${plan.nombre}" no tiene duración válida: se importó sin membresía.`,
        });
      } else {
        registro.membresia = {
          plan,
          fechaInicio: registro.fechaRegistro,
          fechaFin: calcularFinMembresia(registro.fechaRegistro, plan.duracionDias),
        };
      }
    }

    aCrear.push(registro);
  }

  return { aCrear, duplicados, rechazados, advertencias };
}

/** Resumen en texto de lo que hizo (o no) la importación. */
export function resumirImportacion({ importados, duplicados, rechazados, advertencias }) {
  const lineas = [`Se importaron ${importados} usuarios.`];

  if (duplicados.length > 0) {
    lineas.push(`${duplicados.length} se omitieron por teléfono repetido.`);
  }
  if (rechazados.length > 0) {
    const detalle = rechazados
      .slice(0, 3)
      .map((fila) => `fila ${fila.numero}: ${fila.motivo}`)
      .join(" | ");
    const resto = rechazados.length > 3 ? ` (y ${rechazados.length - 3} más)` : "";
    lineas.push(`${rechazados.length} filas con datos incompletos: ${detalle}${resto}`);
  }
  if (advertencias.length > 0) {
    lineas.push(`${advertencias.length} filas se importaron con avisos (revisa la consola).`);
  }

  return lineas.join(" ");
}
