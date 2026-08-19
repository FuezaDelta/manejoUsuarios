/**
 * Composición de la aplicación: crea el estado, el enrutador y las vistas, y
 * las conecta con las escuchas de Firestore.
 *
 * Los datos llegan por `onSnapshot`, así que ya no hay que recargar la colección
 * completa después de cada alta, cobro, borrado o importación: cualquier cambio
 * —incluso hecho desde otro dispositivo— refresca la interfaz solo.
 *
 * `arrancar()` devuelve las funciones para cancelar las escuchas. La app las
 * mantiene vivas hasta que se cierra la página; existen para poder detenerlas
 * desde un test o una futura pantalla de cierre de sesión.
 */
import { mensajeDeError } from "./datos/errores.js";
import { escucharPlanes } from "./datos/planes.js";
import { escucharUsuarios } from "./datos/usuarios.js";
import { crearAlmacen } from "./estado/almacen.js";
import { crearEnrutador } from "./ui/enrutador.js";
import { crearNavegacion } from "./ui/navegacion.js";
import { crearVistaImportar } from "./ui/vistas/importar.js";
import { crearVistaInicio } from "./ui/vistas/inicio.js";
import { crearVistaNuevoUsuario } from "./ui/vistas/nuevo-usuario.js";
import { crearVistaPlanes } from "./ui/vistas/planes.js";
import { crearVistaRegistrarPago } from "./ui/vistas/registrar-pago.js";
import { crearVistaUsuarios } from "./ui/vistas/usuarios.js";

const SECCION_INICIAL = "inicio";
const SECCION_COBRO = "registrar-pago";

const ESTADO_INICIAL = {
  planes: [],
  usuarios: [],
  cargandoPlanes: true,
  cargandoUsuarios: true,
  errorPlanes: null,
  errorUsuarios: null,
  filtroUsuarios: "",
  seccionActual: SECCION_INICIAL,
};

export function arrancar() {
  const almacen = crearAlmacen(ESTADO_INICIAL);
  const navegacion = crearNavegacion();

  const enrutador = crearEnrutador({
    seccionPorDefecto: SECCION_INICIAL,
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
    crearVistaUsuarios({ almacen, irARenovar }),
    crearVistaNuevoUsuario({ enrutador }),
    vistaPago,
    crearVistaPlanes(),
    crearVistaImportar({ almacen }),
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

  return [
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
  ];
}
