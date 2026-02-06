import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referencias a elementos del DOM
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");

// Navegación por secciones
function showSection(sectionId) {
  sections.forEach((s) => s.classList.remove("active"));
  navLinks.forEach((l) => l.classList.remove("active"));
  const section = document.getElementById(sectionId);
  const link = document.querySelector(`.nav-link[href="#${sectionId}"]`);
  if (section) section.classList.add("active");
  if (link) link.classList.add("active");
  nav.classList.remove("is-open");
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const id = link.getAttribute("href").slice(1);
    showSection(id);
  });
});

navToggle.addEventListener("click", () => nav.classList.toggle("is-open"));

// Sincronizar con hash
window.addEventListener("hashchange", () => {
  const id = (window.location.hash || "#inicio").slice(1);
  if (document.getElementById(id)) showSection(id);
});
const hash = (window.location.hash || "#inicio").slice(1);
if (document.getElementById(hash)) showSection(hash);

// --- Firestore: Planes ---
async function cargarPlanes() {
  const snap = await getDocs(collection(db, "planes"));
  const planes = [];
  snap.forEach((d) => planes.push({ id: d.id, ...d.data() }));
  // Ordenar: primero mensualidad, luego bimestre, luego trimestre (por duración)
  return planes
    .filter((p) => p.activo !== false)
    .sort((a, b) => (a.duracionDias || 0) - (b.duracionDias || 0));
}

function renderPlanes(planes) {
  const list = document.getElementById("listaPlanes");
  const selectPago = document.getElementById("pagoPlanId");
  const selectNuevo = document.getElementById("nuevoUsuarioPlanId");
  [selectPago, selectNuevo].forEach((select) => {
    const options = select.querySelectorAll("option:not(:first-child)");
    options.forEach((o) => o.remove());
  });

  if (planes.length === 0) {
    list.innerHTML = "<li class='empty'>No hay planes cargados.</li>";
    return;
  }

  list.innerHTML = planes
    .map(
      (p) =>
        `<li>
          <span class="plan-item__nombre">${p.nombre || p.id}</span>
          <span class="plan-item__precio">$${Number(p.precio || 0).toLocaleString()}</span>
          <span class="plan-item__duracion">${p.duracionDias || 0} días</span>
        </li>`
    )
    .join("");

  planes.forEach((p) => {
    [selectPago, selectNuevo].forEach((select) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nombre || p.id} — $${Number(p.precio || 0).toLocaleString()} (${p.duracionDias} días)`;
      opt.dataset.duracionDias = p.duracionDias;
      opt.dataset.precio = p.precio;
      select.appendChild(opt);
    });
  });
}

// --- Firestore: Usuarios ---
async function cargarUsuarios() {
  const snap = await getDocs(collection(db, "usuarios"));
  const usuarios = [];
  snap.forEach((d) => usuarios.push({ id: d.id, ...d.data() }));
  return usuarios;
}

function renderUsuarios(usuarios, filtro = "") {
  const list = document.getElementById("listaUsuarios");
  const texto = (filtro || "").toLowerCase().trim();
  const filtrados = texto
    ? usuarios.filter(
        (u) =>
          (u.nombre || "").toLowerCase().includes(texto) ||
          (u.apellido || "").toLowerCase().includes(texto) ||
          (u.telefono || "").includes(texto) ||
          (u.email || "").toLowerCase().includes(texto)
      )
    : usuarios;

  if (filtrados.length === 0) {
    list.innerHTML = "<li class='empty'>No hay usuarios o no coincide la búsqueda.</li>";
  } else {
    list.innerHTML = filtrados
      .map(
        (u) => {
          const estado = (u.estadoMembresia || "vencida").toLowerCase();
          const fin = u.fechaFinMembresia?.toDate?.();
          const finStr = fin ? fin.toLocaleDateString("es") : "—";
          const msgWa = `Hola ${(u.nombre || "").trim()}, te contacto desde Fuerza Delta.`;
          const wa = urlWhatsApp(u.telefono, msgWa);
          const linkWa = wa ? `<a href="${wa}" target="_blank" rel="noopener" class="btn btn--whatsapp" title="Abrir WhatsApp">WhatsApp</a>` : "";
          return `<li class="user-item">
            <span class="user-item__name">${u.nombre || ""} ${u.apellido || ""}</span>
            <span class="user-item__meta">${u.telefono || ""} · Vence: ${finStr}</span>
            <span class="user-item__estado user-item__estado--${estado}">${u.estadoMembresia || "vencida"}</span>
            <div class="user-item__actions">
              ${linkWa}
              <button type="button" class="btn btn--renovar" data-user-id="${u.id}">Renovar</button>
              <button type="button" class="btn btn--eliminar" data-user-id="${u.id}">Eliminar</button>
            </div>
          </li>`;
        }
      )
      .join("");
  }
}

async function eliminarUsuarioConPagos(usuarioId) {
  const confirmar = window.confirm(
    "¿Eliminar este usuario y TODOS sus pagos asociados? Esta acción no se puede deshacer."
  );
  if (!confirmar) return;
  try {
    // Borrar pagos del usuario
    const q = query(collection(db, "pagos"), where("usuarioId", "==", usuarioId));
    const pagosSnap = await getDocs(q);
    const borrados = pagosSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(borrados);

    // Borrar el usuario
    await deleteDoc(doc(db, "usuarios", usuarioId));

    await init();
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    alert("No se pudo eliminar el usuario. Revisa la consola y las reglas de Firestore.");
  }
}

function irARenovarUsuario(usuarioId) {
  const usuarios = window.__usuarios || [];
  const u = usuarios.find((x) => x.id === usuarioId);
  if (!u) return;
  document.getElementById("pagoUsuarioId").value = u.id;
  document.getElementById("pagoUsuarioBuscar").value = `${u.nombre || ""} ${u.apellido || ""} · ${u.telefono || ""}`;
  showSection("registrar-pago");
}

function filtrarUsuariosParaCombobox(usuarios, texto) {
  const t = (texto || "").toLowerCase().trim();
  if (!t) return usuarios;
  return usuarios.filter(
    (u) =>
      (u.nombre || "").toLowerCase().includes(t) ||
      (u.apellido || "").toLowerCase().includes(t) ||
      (u.telefono || "").includes(t) ||
      (u.email || "").toLowerCase().includes(t)
  );
}

function abrirComboboxUsuarios(texto) {
  const usuarios = window.__usuarios || [];
  const filtrados = filtrarUsuariosParaCombobox(usuarios, texto);
  const dropdown = document.getElementById("comboboxDropdown");
  dropdown.innerHTML = "";
  dropdown.setAttribute("aria-hidden", "false");
  dropdown.classList.add("is-open");
  if (filtrados.length === 0) {
    dropdown.innerHTML = '<div class="combobox-empty">Sin resultados</div>';
    return;
  }
  filtrados.forEach((u) => {
    const opt = document.createElement("div");
    opt.setAttribute("role", "option");
    opt.dataset.userId = u.id;
    opt.innerHTML = `<span class="option-name">${u.nombre || ""} ${u.apellido || ""}</span><span class="option-meta">${u.telefono || ""}</span>`;
    opt.addEventListener("click", () => {
      document.getElementById("pagoUsuarioId").value = u.id;
      document.getElementById("pagoUsuarioBuscar").value = `${u.nombre || ""} ${u.apellido || ""} · ${u.telefono || ""}`;
      dropdown.classList.remove("is-open");
      dropdown.setAttribute("aria-hidden", "true");
    });
    dropdown.appendChild(opt);
  });
}

function cerrarComboboxUsuarios() {
  const dropdown = document.getElementById("comboboxDropdown");
  dropdown.classList.remove("is-open");
  dropdown.setAttribute("aria-hidden", "true");
}


// --- Dashboard ---
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatearTelefonoWhatsApp(telefono) {
  const digits = (telefono || "").replace(/\D/g, "");
  if (digits.length === 10) return "57" + digits;
  if (digits.length === 12 && digits.startsWith("57")) return digits;
  return digits || "";
}

function urlWhatsApp(telefono, mensaje) {
  const num = formatearTelefonoWhatsApp(telefono);
  if (!num) return "";
  const text = encodeURIComponent(mensaje || "");
  return `https://wa.me/${num}${text ? "?text=" + text : ""}`;
}

function actualizarDashboard(usuarios) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7Dias = addDays(hoy, 7);

  const activos = usuarios.filter((u) => (u.estadoMembresia || "").toLowerCase() === "activa");
  const vencidas = usuarios.filter((u) => (u.estadoMembresia || "").toLowerCase() === "vencida");

  const conFin = activos.filter((u) => u.fechaFinMembresia);
  const proximosVencer = conFin.filter((u) => {
    const fin = u.fechaFinMembresia?.toDate?.() || new Date(0);
    return fin >= hoy && fin <= en7Dias;
  });
  const vencidosList = usuarios.filter((u) => {
    const fin = u.fechaFinMembresia?.toDate?.();
    return fin && fin < hoy;
  });

  document.getElementById("countActivos").textContent = activos.length;
  document.getElementById("countVencidas").textContent = vencidas.length;

  const listProximos = document.getElementById("listaProximosVencer");
  const listVencidos = document.getElementById("listaVencidos");

  listProximos.innerHTML =
    proximosVencer.length === 0
      ? "<li class='empty'>Ninguno en los próximos 7 días.</li>"
      : proximosVencer
        .map(
          (u) => {
            const fin = u.fechaFinMembresia?.toDate?.();
            const finStr = fin ? fin.toLocaleDateString("es") : "";
            const nombre = (u.nombre || "") + " " + (u.apellido || "");
            const msg = `Hola ${(u.nombre || "").trim()}, tu membresía de Fuerza Delta vence el ${finStr}. Te esperamos para renovar.`;
            const wa = urlWhatsApp(u.telefono, msg);
            const linkWa = wa ? ` <a href="${wa}" target="_blank" rel="noopener" class="link-whatsapp" title="Abrir WhatsApp">WhatsApp</a>` : "";
            return `<li><strong>${u.nombre} ${u.apellido}</strong> — Vence ${finStr}${linkWa}</li>`;
          }
        )
        .join("");

  listVencidos.innerHTML =
    vencidosList.length === 0
      ? "<li class='empty'>Ninguno.</li>"
      : vencidosList
        .map(
          (u) => {
            const fin = u.fechaFinMembresia?.toDate?.();
            const finStr = fin ? fin.toLocaleDateString("es") : "";
            const msg = `Hola ${(u.nombre || "").trim()}, tu membresía de Fuerza Delta venció el ${finStr}. Pásate a renovar cuando puedas.`;
            const wa = urlWhatsApp(u.telefono, msg);
            const linkWa = wa ? ` <a href="${wa}" target="_blank" rel="noopener" class="link-whatsapp" title="Abrir WhatsApp">WhatsApp</a>` : "";
            return `<li><strong>${u.nombre} ${u.apellido}</strong> — Venció ${finStr}${linkWa}</li>`;
          }
        )
        .join("");
}

// --- Formulario nuevo usuario (incluye primer pago) ---
const nuevoUsuarioPlanId = document.getElementById("nuevoUsuarioPlanId");
const nuevoUsuarioMonto = document.getElementById("nuevoUsuarioMonto");
nuevoUsuarioPlanId.addEventListener("change", () => {
  const opt = nuevoUsuarioPlanId.selectedOptions[0];
  if (opt?.dataset.precio) nuevoUsuarioMonto.value = opt.dataset.precio;
});

document.getElementById("nuevoUsuarioFechaPago").value = new Date().toISOString().slice(0, 10);

document.getElementById("formUsuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email").value.trim();
    const planId = document.getElementById("nuevoUsuarioPlanId").value;
    const opt = nuevoUsuarioPlanId.selectedOptions[0];
    const duracionDias = Number(opt?.dataset.duracionDias || 30);
    const monto = Number(document.getElementById("nuevoUsuarioMonto").value) || 0;
    const metodoPago = document.getElementById("nuevoUsuarioMetodoPago").value;
    const fechaPagoStr = document.getElementById("nuevoUsuarioFechaPago").value;
    const fechaPago = new Date(fechaPagoStr + "T12:00:00");
    const fechaFin = addDays(fechaPago, duracionDias);

    const userRef = await addDoc(collection(db, "usuarios"), {
      nombre,
      apellido,
      telefono,
      email: email || null,
      fechaRegistro: Timestamp.now(),
      estadoMembresia: "activa",
      membresiaActual: planId,
      fechaInicioMembresia: Timestamp.fromDate(fechaPago),
      fechaFinMembresia: Timestamp.fromDate(fechaFin),
    });

    await addDoc(collection(db, "pagos"), {
      usuarioId: userRef.id,
      planId,
      montoPagado: monto,
      metodoPago,
      fechaPago: Timestamp.fromDate(fechaPago),
      fechaInicio: Timestamp.fromDate(fechaPago),
      fechaFin: Timestamp.fromDate(fechaFin),
    });

    e.target.reset();
    document.getElementById("nuevoUsuarioFechaPago").value = new Date().toISOString().slice(0, 10);
    await init();
    showSection("inicio");
  } catch (err) {
    console.error(err);
    alert("Error al guardar. Revisa la consola y la configuración de Firebase.");
  } finally {
    btn.disabled = false;
  }
});

// --- Formulario registrar pago ---
const pagoPlanId = document.getElementById("pagoPlanId");
const montoPagado = document.getElementById("montoPagado");
pagoPlanId.addEventListener("change", () => {
  const opt = pagoPlanId.selectedOptions[0];
  if (opt?.dataset.precio) montoPagado.value = opt.dataset.precio;
});

document.getElementById("formPago").addEventListener("submit", async (e) => {
  e.preventDefault();
  const usuarioId = document.getElementById("pagoUsuarioId").value;
  if (!usuarioId) {
    document.getElementById("pagoUsuarioBuscar").focus();
    alert("Selecciona un usuario de la lista.");
    return;
  }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const planId = document.getElementById("pagoPlanId").value;
    const opt = pagoPlanId.selectedOptions[0];
    const duracionDias = Number(opt?.dataset.duracionDias || 30);
    const monto = Number(document.getElementById("montoPagado").value) || 0;
    const metodoPago = document.getElementById("metodoPago").value;
    const fechaPagoStr = document.getElementById("fechaPago").value;
    const fechaPago = new Date(fechaPagoStr + "T12:00:00");
    const fechaFin = addDays(fechaPago, duracionDias);

    await addDoc(collection(db, "pagos"), {
      usuarioId,
      planId,
      montoPagado: monto,
      metodoPago,
      fechaPago: Timestamp.fromDate(fechaPago),
      fechaInicio: Timestamp.fromDate(fechaPago),
      fechaFin: Timestamp.fromDate(fechaFin),
    });

    await updateDoc(doc(db, "usuarios", usuarioId), {
      membresiaActual: planId,
      fechaInicioMembresia: Timestamp.fromDate(fechaPago),
      fechaFinMembresia: Timestamp.fromDate(fechaFin),
      estadoMembresia: "activa",
    });

    e.target.reset();
    document.getElementById("fechaPago").value = new Date().toISOString().slice(0, 10);
    await init();
    showSection("inicio");
  } catch (err) {
    console.error(err);
    alert("Error al registrar el pago. Revisa la consola y Firebase.");
  } finally {
    btn.disabled = false;
  }
});

// Fecha de pago por defecto: hoy
document.getElementById("fechaPago").value = new Date().toISOString().slice(0, 10);

// --- Buscador desplegable (combobox) en Registrar pago ---
const pagoUsuarioBuscar = document.getElementById("pagoUsuarioBuscar");
const comboboxDropdown = document.getElementById("comboboxDropdown");
pagoUsuarioBuscar.addEventListener("focus", () => abrirComboboxUsuarios(pagoUsuarioBuscar.value));
pagoUsuarioBuscar.addEventListener("input", () => {
  document.getElementById("pagoUsuarioId").value = "";
  abrirComboboxUsuarios(pagoUsuarioBuscar.value);
});
pagoUsuarioBuscar.addEventListener("blur", () => {
  setTimeout(cerrarComboboxUsuarios, 200);
});
// Al cambiar de sección, limpiar combobox si no hay usuario seleccionado
document.querySelector('.nav-link[href="#registrar-pago"]').addEventListener("click", () => {
  const id = document.getElementById("pagoUsuarioId").value;
  if (!id) {
    pagoUsuarioBuscar.value = "";
  }
});

// --- Importar usuarios (carga masiva desde CSV) ---
const PLANTILLA_CSV = "nombre;apellido;telefono;email;fechaRegistro;plan\nJuan;Pérez;3001234567;juan@ejemplo.com;01/02/2026;mensual_basic\nMaría;García;3109876543;;05/01/2026;bimestre_basic";

function parseFecha(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (!s) return null;
  const parts = s.split(/[\/\-.]/).map((n) => parseInt(n, 10));
  if (parts.length < 3) return null;
  const [a, b, c] = parts;
  if (s.match(/^\d{4}-\d{1,2}-\d{1,2}/)) return new Date(a, b - 1, c);
  if (c > 31) return new Date(c, b - 1, a);
  return new Date(c, b - 1, a);
}

function parseCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const sep = lineas[0].includes(";") ? ";" : ",";
  const headers = lineas[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const filas = [];
  for (let i = 1; i < lineas.length; i++) {
    const valores = [];
    let rest = lineas[i];
    while (rest.length) {
      if (rest.startsWith('"')) {
        const end = rest.indexOf('"', 1);
        valores.push(end === -1 ? rest.slice(1) : rest.slice(1, end));
        rest = end === -1 ? "" : rest.slice(end + 1).replace(/^[\s,;]/, "");
      } else {
        const idx = rest.search(new RegExp(`[${sep}]`));
        valores.push(idx === -1 ? rest.trim() : rest.slice(0, idx).trim());
        rest = idx === -1 ? "" : rest.slice(idx + 1);
      }
    }
    const obj = {};
    headers.forEach((h, j) => (obj[h] = (valores[j] || "").trim()));
    if (obj.nombre || obj.apellido || obj.telefono) filas.push(obj);
  }
  return filas;
}

document.getElementById("descargarPlantilla").addEventListener("click", (e) => {
  e.preventDefault();
  const blob = new Blob(["\uFEFF" + PLANTILLA_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_usuarios.csv";
  a.click();
  URL.revokeObjectURL(url);
});

let archivoCsvSeleccionado = null;
document.getElementById("archivoCsv").addEventListener("change", (e) => {
  archivoCsvSeleccionado = e.target.files[0] || null;
  document.getElementById("btnImportar").disabled = !archivoCsvSeleccionado;
  document.getElementById("resultadoImportacion").textContent = "";
});

document.getElementById("btnImportar").addEventListener("click", async () => {
  if (!archivoCsvSeleccionado) return;
  const btn = document.getElementById("btnImportar");
  const resultado = document.getElementById("resultadoImportacion");
  btn.disabled = true;
  resultado.textContent = "Importando...";
  try {
    const texto = await archivoCsvSeleccionado.text();
    const filas = parseCSV(texto);
    if (filas.length === 0) {
      resultado.textContent = "No se encontraron filas válidas (nombre, apellido o teléfono). Revisa el CSV.";
      btn.disabled = false;
      return;
    }
    const colRef = collection(db, "usuarios");
    const BATCH_SIZE = 500;
    let importados = 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    for (let i = 0; i < filas.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = filas.slice(i, i + BATCH_SIZE);
      for (const row of chunk) {
        const fechaRegistroDate = parseFecha(row.fecharegistro || row.fecha_registro) || new Date();
        const planIdRaw = (row.plan || row.tipomembresia || row.membresia || "").trim();
        const planEncontrado = planIdRaw
          ? planes.find(
              (p) =>
                p.id === planIdRaw ||
                (p.nombre || "").toLowerCase() === planIdRaw.toLowerCase()
            )
          : null;
        const datos = {
          nombre: (row.nombre || "").trim(),
          apellido: (row.apellido || "").trim(),
          telefono: (row.telefono || "").trim(),
          email: (row.email || "").trim() || null,
          fechaRegistro: Timestamp.fromDate(fechaRegistroDate),
          estadoMembresia: "vencida",
        };
        if (planEncontrado) {
          const duracionDias = planEncontrado.duracionDias || 30;
          const fechaFin = new Date(fechaRegistroDate);
          fechaFin.setDate(fechaFin.getDate() + duracionDias);
          datos.membresiaActual = planEncontrado.id;
          datos.fechaInicioMembresia = Timestamp.fromDate(fechaRegistroDate);
          datos.fechaFinMembresia = Timestamp.fromDate(fechaFin);
          datos.estadoMembresia = fechaFin >= hoy ? "activa" : "vencida";
        }
        const ref = doc(colRef);
        batch.set(ref, datos);
        importados++;
      }
      await batch.commit();
    }
    resultado.textContent = `Se importaron ${importados} usuarios. Puedes ir a Usuarios para verlos y renovar cuando paguen.`;
    document.getElementById("archivoCsv").value = "";
    archivoCsvSeleccionado = null;
    btn.disabled = true;
    await init();
  } catch (err) {
    console.error(err);
    resultado.textContent = "Error al importar. Revisa que el CSV tenga columnas nombre, apellido, telefono, email.";
  } finally {
    btn.disabled = false;
  }
});

// Búsqueda de usuarios
document.getElementById("buscarUsuario").addEventListener("input", (e) => {
  renderUsuarios(window.__usuarios || [], e.target.value);
});

// Botones en la lista de usuarios: Renovar / Eliminar
document.getElementById("listaUsuarios").addEventListener("click", (e) => {
  const btnEliminar = e.target.closest(".btn--eliminar");
  if (btnEliminar) {
    const userId = btnEliminar.dataset.userId;
    if (userId) eliminarUsuarioConPagos(userId);
    return;
  }
  const btnRenovar = e.target.closest(".btn--renovar");
  if (btnRenovar) {
    const userId = btnRenovar.dataset.userId;
    if (userId) irARenovarUsuario(userId);
  }
});

// Inicialización
let planes = [];
let usuarios = [];

async function init() {
  try {
    planes = await cargarPlanes();
    usuarios = await cargarUsuarios();
    window.__usuarios = usuarios;
    renderPlanes(planes);
    renderUsuarios(usuarios);
    actualizarDashboard(usuarios);
  } catch (err) {
    console.error("Error cargando datos:", err);
    const msg = err.code === "permission-denied"
      ? "Firestore: acceso denegado. En Firebase Console → Firestore → Reglas, habilita lectura/escritura para desarrollo (ver README)."
      : `Error: ${err.message || err}. Revisa js/firebase-config.js y las reglas de Firestore.`;
    document.getElementById("listaPlanes").innerHTML =
      "<li class='empty'>" + msg + "</li>";
  }
}

init();
