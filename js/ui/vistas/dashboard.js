/**
 * Dashboard: indicadores del mes y gráficos (ApexCharts, global `window.ApexCharts`).
 *
 * Los gráficos solo se dibujan con la sección visible: ApexCharts mide el
 * contenedor al pintar y, dentro de un `display: none`, saldría con ancho 0.
 * Cuando llegan datos nuevos con la sección oculta, se marca como pendiente y
 * se dibuja al entrar.
 */
import { aMedianoche, aValorInput, desdeValorInput, hoyLocal } from "../../dominio/fechas.js";
import { clasificarUsuarios } from "../../dominio/membresias.js";
import { byId } from "../dom.js";
import { inicializarDashboardExport } from "../dashboard-export.js";

const SECCION = "dashboard";
const MS_POR_DIA = 86400000;
const PALETA = ["#6d7c3d", "#c94a4a", "#e8e4dc", "#8fa15a", "#7d8c4a"];
const COLOR_EJES = "#9a958a";
const COLOR_LEYENDA = "#e8e4dc";

function formatearCOP(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function finDelDia(fecha) {
  const copia = new Date(fecha.getTime());
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function claveDia(fecha) {
  return aValorInput(fecha);
}

/**
 * Buckets { clave, etiqueta, inicio, fin } para un rango personalizado.
 * Hasta 62 días: por día; hasta 400: por semanas de 7 días; más: por mes (máx. 5 años).
 */
function bucketsDeRango(desdeTexto, hastaTexto) {
  const desdeFecha = desdeValorInput(desdeTexto);
  const hastaFecha = desdeValorInput(hastaTexto);
  if (!desdeFecha || !hastaFecha) return { error: "Indica fecha «Desde» y «Hasta»." };
  if (desdeFecha > hastaFecha) return { error: "«Desde» no puede ser posterior a «Hasta»." };

  const desde = aMedianoche(desdeFecha);
  const hasta = finDelDia(hastaFecha);
  const dias = Math.floor((hasta - desde) / MS_POR_DIA) + 1;
  if (dias > 365 * 5) return { error: "El rango máximo es 5 años. Reduce el intervalo." };

  const buckets = [];
  const etiquetaCorta = (f) => f.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  if (dias <= 62) {
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      const inicio = aMedianoche(d);
      buckets.push({ clave: claveDia(inicio), etiqueta: etiquetaCorta(inicio), inicio, fin: finDelDia(inicio) });
    }
  } else if (dias <= 400) {
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 7)) {
      const inicio = aMedianoche(d);
      const ultimo = new Date(d);
      ultimo.setDate(ultimo.getDate() + 6);
      const limite = ultimo > hasta ? new Date(hasta) : ultimo;
      buckets.push({
        clave: `s-${claveDia(inicio)}`,
        etiqueta: `${etiquetaCorta(inicio)} – ${etiquetaCorta(limite)}`,
        inicio,
        fin: finDelDia(limite),
      });
    }
  } else {
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
    while (cursor <= hasta) {
      const inicioMes = aMedianoche(cursor);
      const finMes = finDelDia(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
      const inicio = inicioMes < desde ? new Date(desde) : inicioMes;
      const fin = finMes > hasta ? new Date(hasta) : finMes;
      buckets.push({
        clave: claveDia(inicioMes),
        etiqueta: cursor.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
        inicio,
        fin,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const agrupacion = dias <= 62 ? "día" : dias <= 400 ? "semana" : "mes";
  const formatoLargo = { day: "numeric", month: "short", year: "numeric" };
  const titulo = `Ingresos del ${desdeFecha.toLocaleDateString("es-CO", formatoLargo)} al ${hastaFecha.toLocaleDateString("es-CO", formatoLargo)} (por ${agrupacion})`;
  return { error: null, buckets, titulo };
}

/** Un bucket por mes calendario, terminando en el mes actual. */
function bucketsDeMeses(hoy, cantidad) {
  const buckets = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    buckets.push({
      clave: claveDia(inicio),
      etiqueta: inicio.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }),
      inicio,
      fin: finDelDia(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0)),
    });
  }
  return buckets;
}

function mesesDesdeElPrimerPago(pagos, hoy) {
  const fechas = pagos.map((p) => p.fechaPago).filter(Boolean);
  if (fechas.length === 0) return 1;
  const primera = new Date(Math.min(...fechas.map((f) => f.getTime())));
  const total = (hoy.getFullYear() - primera.getFullYear()) * 12 + (hoy.getMonth() - primera.getMonth()) + 1;
  return Math.max(1, total);
}

function tituloDePeriodo(filtro, meses) {
  if (filtro === "all") return meses <= 1 ? "Ingresos del histórico" : `Ingresos del histórico (${meses} meses)`;
  if (meses === 1) return "Ingresos del último mes";
  if (meses === 12) return "Ingresos del último año";
  return `Ingresos últimos ${meses} meses`;
}

function sumarPorBuckets(pagos, buckets) {
  const totales = buckets.map(() => 0);
  for (const pago of pagos) {
    const fecha = pago.fechaPago;
    if (!fecha) continue;
    const indice = buckets.findIndex((b) => fecha >= b.inicio && fecha <= b.fin);
    if (indice >= 0) totales[indice] += pago.montoPagado;
  }
  return totales;
}

export function crearVistaDashboard({ almacen }) {
  const kpiActivos = byId("kpiActivos");
  const kpiVencidos = byId("kpiVencidos");
  const kpiIngresoMes = byId("kpiIngresoMes");
  const kpiTicket = byId("kpiTicketPromedio");
  const selectPeriodo = byId("filtroIngresosPeriodo");
  const panelRango = byId("ingresosRangoPersonalizado");
  const campoDesde = byId("ingresoFechaDesde");
  const campoHasta = byId("ingresoFechaHasta");
  const avisoRango = byId("ingresosRangoError");
  const tituloIngresos = byId("tituloChartIngresos");
  const botonAplicarRango = byId("btnAplicarRangoIngresos");
  const contenedores = {
    estado: byId("chartEstadoMembresias"),
    metodos: byId("chartMetodosPago"),
    ingresos: byId("chartIngresosMensuales"),
    planes: byId("chartPlanesVendidos"),
  };

  const graficos = {};
  let filtroPeriodo = selectPeriodo.value;
  let pendiente = true;
  let ultimoEstado = null;

  function dibujarGrafico(nombre, opciones) {
    graficos[nombre]?.destroy();
    graficos[nombre] = new window.ApexCharts(contenedores[nombre], opciones);
    graficos[nombre].render();
  }

  function mostrarMensajeEnGraficos(texto) {
    for (const contenedor of Object.values(contenedores)) {
      contenedor.innerHTML = "";
      const parrafo = document.createElement("p");
      parrafo.className = "empty";
      parrafo.textContent = texto;
      contenedor.append(parrafo);
    }
  }

  function pintarIndicadores(estado) {
    const { usuarios, pagos, cargandoUsuarios, cargandoPagos } = estado;
    if (cargandoUsuarios || cargandoPagos) {
      for (const kpi of [kpiActivos, kpiVencidos, kpiIngresoMes, kpiTicket]) kpi.textContent = "-";
      return null;
    }
    const { activos, vencidos } = clasificarUsuarios(usuarios);
    const hoy = hoyLocal();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = finDelDia(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
    const pagosMes = pagos.filter((p) => p.fechaPago && p.fechaPago >= inicioMes && p.fechaPago <= finMes);
    const ingresoMes = pagosMes.reduce((total, p) => total + p.montoPagado, 0);

    kpiActivos.textContent = String(activos.length);
    kpiVencidos.textContent = String(vencidos.length);
    kpiIngresoMes.textContent = formatearCOP(ingresoMes);
    kpiTicket.textContent = formatearCOP(pagosMes.length ? ingresoMes / pagosMes.length : 0);
    return { activos: activos.length, vencidos: vencidos.length };
  }

  function bucketsDeIngresos(pagos) {
    avisoRango.hidden = true;
    avisoRango.textContent = "";
    if (filtroPeriodo === "custom") {
      const rango = bucketsDeRango(campoDesde.value, campoHasta.value);
      if (rango.error) {
        avisoRango.textContent = rango.error;
        avisoRango.hidden = false;
        return { buckets: [], titulo: "Ingresos" };
      }
      return rango;
    }
    const hoy = hoyLocal();
    const meses = filtroPeriodo === "all" ? mesesDesdeElPrimerPago(pagos, hoy) : Number(filtroPeriodo) || 6;
    return { buckets: bucketsDeMeses(hoy, meses), titulo: tituloDePeriodo(filtroPeriodo, meses) };
  }

  function pintarGraficos(estado) {
    const { pagos, planes, errorUsuarios, errorPagos } = estado;
    if (errorUsuarios || errorPagos) {
      mostrarMensajeEnGraficos(errorPagos || errorUsuarios);
      return;
    }
    const conteo = pintarIndicadores(estado);
    if (!conteo) {
      mostrarMensajeEnGraficos("Cargando…");
      return;
    }
    if (typeof window.ApexCharts === "undefined") {
      mostrarMensajeEnGraficos("No se pudo cargar la librería de gráficos. Revisa tu conexión y recarga.");
      return;
    }

    dibujarGrafico("estado", {
      chart: { type: "donut", height: 300, toolbar: { show: false } },
      series: [conteo.activos, conteo.vencidos],
      labels: ["Activos", "Vencidos"],
      colors: [PALETA[0], PALETA[1]],
      legend: { labels: { colors: COLOR_LEYENDA } },
      theme: { mode: "dark" },
    });

    const porMetodo = {};
    for (const pago of pagos) porMetodo[pago.metodoPago] = (porMetodo[pago.metodoPago] || 0) + 1;
    const metodos = Object.keys(porMetodo);
    dibujarGrafico("metodos", {
      chart: { type: "pie", height: 300, toolbar: { show: false } },
      series: metodos.length ? metodos.map((m) => porMetodo[m]) : [1],
      labels: metodos.length ? metodos : ["Sin datos"],
      colors: [PALETA[0], PALETA[2], PALETA[4], "#4a5528"],
      legend: { labels: { colors: COLOR_LEYENDA } },
      theme: { mode: "dark" },
    });

    const { buckets, titulo } = bucketsDeIngresos(pagos);
    tituloIngresos.textContent = titulo || "Ingresos";
    const hayBuckets = buckets.length > 0;
    dibujarGrafico("ingresos", {
      chart: { type: "bar", height: 320, toolbar: { show: false } },
      series: [{ name: "Ingresos", data: hayBuckets ? sumarPorBuckets(pagos, buckets) : [0] }],
      xaxis: {
        categories: hayBuckets ? buckets.map((b) => b.etiqueta) : ["Sin rango válido"],
        labels: { style: { colors: COLOR_EJES } },
      },
      yaxis: { labels: { style: { colors: COLOR_EJES }, formatter: formatearCOP } },
      tooltip: { y: { formatter: formatearCOP } },
      dataLabels: { enabled: true, formatter: formatearCOP, style: { colors: ["#ffffff"] } },
      colors: [PALETA[0]],
      theme: { mode: "dark" },
    });

    const nombrePlan = new Map(planes.map((p) => [p.id, p.nombre]));
    const porPlan = {};
    for (const pago of pagos) {
      const nombre = nombrePlan.get(pago.planId) || pago.planId || "Sin plan";
      porPlan[nombre] = (porPlan[nombre] || 0) + 1;
    }
    const topPlanes = Object.entries(porPlan).sort((a, b) => b[1] - a[1]).slice(0, 6);
    dibujarGrafico("planes", {
      chart: { type: "bar", height: 320, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      series: [{ name: "Pagos", data: topPlanes.map((p) => p[1]) }],
      xaxis: { categories: topPlanes.map((p) => p[0]), labels: { style: { colors: COLOR_EJES } } },
      yaxis: { labels: { style: { colors: COLOR_EJES } } },
      colors: [PALETA[4]],
      theme: { mode: "dark" },
    });
  }

  function redibujar() {
    if (!ultimoEstado || ultimoEstado.seccionActual !== SECCION) {
      pendiente = true;
      return;
    }
    pendiente = false;
    pintarGraficos(ultimoEstado);
  }

  function actualizarPanelRango() {
    const esRango = selectPeriodo.value === "custom";
    panelRango.hidden = !esRango;
    if (esRango && (!campoDesde.value || !campoHasta.value)) {
      const hoy = hoyLocal();
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 14);
      campoHasta.value = aValorInput(hoy);
      campoDesde.value = aValorInput(desde);
    }
  }

  selectPeriodo.addEventListener("change", () => {
    filtroPeriodo = selectPeriodo.value;
    actualizarPanelRango();
    redibujar();
  });
  botonAplicarRango.addEventListener("click", redibujar);
  actualizarPanelRango();

  inicializarDashboardExport(() => {
    const { usuarios, pagos, planes } = almacen.obtener();
    return { usuarios, pagos, planes };
  });

  const claves = ["usuarios", "pagos", "planes", "cargandoUsuarios", "cargandoPagos", "errorUsuarios", "errorPagos"];

  return {
    render(estado) {
      const anterior = ultimoEstado;
      ultimoEstado = estado;
      const datosCambiaron = !anterior || claves.some((clave) => anterior[clave] !== estado[clave]);
      const entro = estado.seccionActual === SECCION && anterior?.seccionActual !== SECCION;
      if (datosCambiaron) pendiente = true;
      if (estado.seccionActual === SECCION && (pendiente || entro)) redibujar();
    },
  };
}
