/**
 * Composición de la aplicación: crea el estado, el enrutador y las vistas, y
 * las conecta con las escuchas de Firestore.
 *
 * Los datos llegan por `onSnapshot`, así que ya no hay que recargar la colección
 * completa después de cada alta, cobro, borrado o importación: cualquier cambio
 * —incluso hecho desde otro dispositivo— refresca la interfaz solo.
 *
 * Las escuchas de Firestore solo se abren con una sesión iniciada (ver
 * `ui/vistas/login.js`) y se cierran al pulsar "Salir": así no se descargan
 * datos de socios sin haber entrado, y al cerrar sesión no queda nada en pantalla.
 */
import { mensajeDeError } from "./datos/errores.js";
import { escucharPagos } from "./datos/pagos.js";
import { escucharPlanes } from "./datos/planes.js";
import { escucharStaff } from "./datos/staff.js";
import { escucharUsuarios } from "./datos/usuarios.js";
import { crearAlmacen } from "./estado/almacen.js";
import { puedeVerSeccion, ROL } from "./dominio/roles.js";
import { crearEnrutador } from "./ui/enrutador.js";
import { crearNavegacion } from "./ui/navegacion.js";
import { crearVistaDashboard } from "./ui/vistas/dashboard.js";
import { crearVistaImportar } from "./ui/vistas/importar.js";
import { crearVistaInicio } from "./ui/vistas/inicio.js";
import { crearVistaLogin } from "./ui/vistas/login.js";
import { crearVistaPersonal } from "./ui/vistas/personal.js";
import { crearVistaNuevoUsuario } from "./ui/vistas/nuevo-usuario.js";
import { crearVistaPlanes } from "./ui/vistas/planes.js";
import { crearVistaRegistrarPago } from "./ui/vistas/registrar-pago.js";
import { crearVistaUsuarios } from "./ui/vistas/usuarios.js";

const SECCION_INICIAL = "inicio";
const SECCION_COBRO = "registrar-pago";

const DATOS_VACIOS = {
  planes: [],
  usuarios: [],
  pagos: [],
  cargandoPlanes: true,
  cargandoUsuarios: true,
  cargandoPagos: true,
  errorPlanes: null,
  errorUsuarios: null,
  errorPagos: null,
  staff: [],
  cargandoStaff: true,
  errorStaff: null,
};

const ESTADO_INICIAL = {
  ...DATOS_VACIOS,
  perfil: null,
  filtroUsuarios: "",
  seccionActual: SECCION_INICIAL,
};

export function arrancar() {
  const almacen = crearAlmacen(ESTADO_INICIAL);
  const navegacion = crearNavegacion();

  const enrutador = crearEnrutador({
    seccionPorDefecto: SECCION_INICIAL,
    // Sin perfil todavía (pantalla de login) no se redirige, para no perder el
    // enlace directo; al entrar se vuelve a evaluar con `refrescar()`.
    puedeVer: (id) => {
      const rol = almacen.obtener().perfil?.rol;
      return !rol || puedeVerSeccion(rol, id);
    },
    alNavegar: (id) => {
      navegacion.cerrar();
      almacen.actualizar({ seccionActual: id });
    },
  });

  const vistaPago = crearVistaRegistrarPago({ almacen, enrutador });

  /** Los botones "Renovar" preparan el cobro y llevan al formulario. */
  const irARenovar = (usuarioId) => {
    vistaPago.seleccionarUsuario(usuarioId);
    enrutador.navegar(SECCION_COBRO);
  };

  const vistas = [
    crearVistaInicio({ irARenovar }),
    crearVistaDashboard({ almacen }),
    crearVistaUsuarios({ almacen, irARenovar }),
    crearVistaNuevoUsuario({ enrutador }),
    vistaPago,
    crearVistaPlanes(),
    crearVistaImportar({ almacen }),
    crearVistaPersonal(),
  ];

  almacen.suscribir((estado) => {
    for (const vista of vistas) {
      // Se aísla cada vista: si una falla al pintar, las demás se actualizan igual.
      try {
        vista.render?.(estado);
      } catch (error) {
        console.error("Error al pintar una vista:", error);
      }
    }
  });

  enrutador.iniciar();

  let cancelarEscuchas = [];
  let cancelarEscuchaStaff = null;

  /** La lista del personal solo la puede leer un administrador. */
  function sincronizarEscuchaStaff(perfil) {
    const esAdmin = perfil?.rol === ROL.ADMIN;
    if (esAdmin && !cancelarEscuchaStaff) {
      almacen.actualizar({ staff: [], cargandoStaff: true, errorStaff: null });
      cancelarEscuchaStaff = escucharStaff(
        (staff) => almacen.actualizar({ staff, cargandoStaff: false, errorStaff: null }),
        (error) => {
          console.error("Error al cargar el personal:", error);
          almacen.actualizar({
            cargandoStaff: false,
            errorStaff: mensajeDeError(error, "No se pudo cargar el personal."),
          });
        }
      );
    } else if (!esAdmin && cancelarEscuchaStaff) {
      cancelarEscuchaStaff();
      cancelarEscuchaStaff = null;
      almacen.actualizar({ staff: [], cargandoStaff: true, errorStaff: null });
    }
  }

  function abrirEscuchas() {
    cerrarEscuchas();
    almacen.actualizar(DATOS_VACIOS);
    cancelarEscuchas = [
      escucharPlanes(
        (planes) => almacen.actualizar({ planes, cargandoPlanes: false, errorPlanes: null }),
        (error) => {
          console.error("Error al cargar los planes:", error);
          almacen.actualizar({
            cargandoPlanes: false,
            errorPlanes: mensajeDeError(error, "No se pudieron cargar los planes."),
          });
        }
      ),
      escucharUsuarios(
        (usuarios) => almacen.actualizar({ usuarios, cargandoUsuarios: false, errorUsuarios: null }),
        (error) => {
          console.error("Error al cargar los usuarios:", error);
          almacen.actualizar({
            cargandoUsuarios: false,
            errorUsuarios: mensajeDeError(error, "No se pudieron cargar los usuarios."),
          });
        }
      ),
      escucharPagos(
        (pagos) => almacen.actualizar({ pagos, cargandoPagos: false, errorPagos: null }),
        (error) => {
          console.error("Error al cargar los pagos:", error);
          almacen.actualizar({
            cargandoPagos: false,
            errorPagos: mensajeDeError(error, "No se pudieron cargar los pagos."),
          });
        }
      ),
    ];
  }

  function cerrarEscuchas() {
    for (const cancelar of cancelarEscuchas) cancelar();
    cancelarEscuchas = [];
    sincronizarEscuchaStaff(null);
  }

  crearVistaLogin({
    alIniciar: (perfil) => {
      abrirEscuchas();
      almacen.actualizar({ perfil });
      sincronizarEscuchaStaff(perfil);
      enrutador.refrescar();
    },
    alCambiarPerfil: (perfil) => {
      almacen.actualizar({ perfil });
      sincronizarEscuchaStaff(perfil);
      enrutador.refrescar();
    },
    alCerrar: () => {
      cerrarEscuchas();
      almacen.actualizar({ ...DATOS_VACIOS, perfil: null });
      enrutador.navegar(SECCION_INICIAL, { reemplazar: true });
    },
  });
}
