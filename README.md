# Fuerza Delta — Gestión de usuarios y pagos

App web para administrar los socios, planes y pagos del gimnasio. Es una página
estática (HTML + CSS + JavaScript con módulos ES nativos, sin build) que guarda
los datos en **Firebase Firestore** y se puede publicar en GitHub Pages.

## Cómo ejecutarla en local

Los módulos ES no funcionan abriendo el archivo con doble clic (`file://`), hace
falta servirlo por HTTP:

```bash
npm start
```

Eso levanta un servidor estático en la raíz del proyecto. Alternativa sin Node:
la extensión **Live Server** de VS Code → "Go Live".

## Estructura del proyecto

El código está separado en capas y cada una solo depende de las de abajo. La
regla que las mantiene ordenadas: `dominio/` y `utilidades/` no importan nada de
Firebase ni tocan el DOM, y por eso son las que tienen tests.

```
index.html                 Marcado de las 6 secciones
css/style.css              Estilos (mobile-first)

js/
  main.js                  Punto de entrada. Carga la app con import() dentro de
                           un try/catch, para que un fallo del CDN no deje la
                           página en blanco y muda.
  aplicacion.js            Composición: crea el estado, el enrutador y las
                           vistas, y las conecta con las escuchas de Firestore.

  firebase/
    config.js              Configuración pública del proyecto
    cliente.js             ÚNICO archivo con la versión del SDK y las URLs del CDN

  dominio/                 Reglas de negocio puras (sin Firebase, sin DOM)
    fechas.js              Fechas de calendario, parseo y formato
    membresias.js          Cuándo vence y cuándo está activa una membresía
    validacion.js          Validación y normalización de usuarios y pagos
    importacion.js         Interpretación de las filas de un CSV
    busqueda.js            Filtro de usuarios

  datos/                   Acceso a Firestore y casos de uso
    planes.js              Catálogo de planes (solo lectura)
    usuarios.js            Usuarios y operaciones que los combinan con pagos
    pagos.js               Documentos de pago y consultas
    errores.js             Traducción de errores técnicos a mensajes legibles

  estado/almacen.js        Estado central con suscripciones

  ui/
    html.js                Plantillas con escapado automático (anti-XSS)
    dom.js                 byId, delegación de eventos, debounce
    enrutador.js           Navegación entre secciones (con historial)
    navegacion.js          Menú del encabezado
    notificaciones.js      Avisos de éxito y error por sección
    modal.js               Diálogo de confirmación
    combobox.js            Buscador desplegable accesible
    campos-pago.js         Campos de cobro compartidos por los dos formularios
    memo.js                Evita repintados innecesarios
    plantillas.js          Fragmentos de HTML comunes
    vistas/                Una por sección

tests/                     Tests unitarios del dominio y las utilidades
firestore.rules            Reglas de seguridad (versionadas)
```

### Reglas que conviene mantener

- **Nunca asignar `innerHTML` directamente.** Usa `pintar()` y las plantillas
  `html` de `ui/html.js`, que escapan cada valor interpolado. ESLint bloquea
  cualquier otro uso de `innerHTML`.
- **La versión del SDK de Firebase se toca solo en `js/firebase/cliente.js`.**
  Ningún otro archivo importa del CDN.
- **El estado de la membresía no se guarda en Firestore**, se deriva de
  `fechaFinMembresia` con `dominio/membresias.js`. Un estado persistido queda
  obsoleto al día siguiente si nadie lo recalcula, y aquí no hay ningún proceso
  de servidor que lo haga.
- **La duración y el precio de un plan se leen del estado, nunca del DOM.**

## Comandos

```bash
npm start        # servidor estático local
npm test         # tests unitarios (Vitest)
npm run test:watch
npm run lint     # ESLint
```

Las dependencias son solo de desarrollo: la app en producción no necesita ni
`npm install` ni compilación.

## Configuración de Firebase

`js/firebase/config.js` contiene la configuración del proyecto `manejo-65354`.

Esos valores **no son secretos**: el SDK web los expone en el navegador de
cualquiera que abra la página, así que ocultarlos no protege nada. La seguridad
de los datos depende exclusivamente de las reglas de Firestore.

Para apuntar a otro proyecto: Firebase Console → Configuración del proyecto →
Tus apps → app Web, y copia el objeto `firebaseConfig`.

## Seguridad: estado actual y cómo cerrarla

⚠️ **Ahora mismo la base de datos está abierta.** No hay inicio de sesión, y las
reglas permiten leer y escribir a cualquiera que conozca el `projectId`. Eso
incluye los datos personales de los socios.

`firestore.rules` ya está en el repositorio, endurecido y listo para cerrarse.
Frente a la configuración anterior aporta tres cosas incluso sin autenticación:

- `planes` es de solo lectura para el cliente (la app nunca los escribe).
- Se valida la forma de cada documento: nadie puede meter campos inesperados ni
  textos gigantes.
- Cualquier colección no declarada queda denegada.

Para cerrarla del todo:

1. Firebase Console → **Authentication** → habilitar un proveedor
   (Email/contraseña es lo más simple).
2. Crear el usuario o usuarios que administran el gimnasio.
3. Añadir la pantalla de inicio de sesión en la app.
4. En `firestore.rules`, cambiar `modoAbierto()` para que devuelva `false`.
5. Desplegar las reglas: Firebase Console → Firestore → Reglas (pegar el
   archivo), o `firebase deploy --only firestore:rules`.

Mientras `modoAbierto()` sea `true`, el paso 4 es lo único que separa la base de
estar protegida.

## Modelo de datos

**`planes`** — catálogo, se administra desde Firebase Console.

| Campo          | Tipo    | Notas                                   |
| -------------- | ------- | --------------------------------------- |
| `nombre`       | string  | Se muestra en los desplegables          |
| `precio`       | number  |                                         |
| `duracionDias` | number  | Entero > 0. Si no lo es, no se ofrece   |
| `activo`       | boolean | `false` lo oculta                       |

**`usuarios`**

| Campo                  | Tipo             |
| ---------------------- | ---------------- |
| `nombre`, `apellido`   | string           |
| `telefono`             | string, 10 dígitos |
| `email`                | string o null    |
| `fechaRegistro`        | timestamp        |
| `membresiaActual`      | string (id de plan) |
| `fechaInicioMembresia` | timestamp        |
| `fechaFinMembresia`    | timestamp        |

**`pagos`** — histórico. Se crean y, al borrar un socio, se eliminan en cascada;
nunca se modifican. `origen` vale `"manual"` (cobro en la app) o `"importacion"`
(membresía traída de un CSV, con `montoPagado: 0` para no inventar ingresos).

## Importar usuarios desde CSV

Columnas reconocidas (el orden no importa, y se aceptan variantes como
`nombres`, `celular`, `correo`, `fecha_registro`, `Fecha Registro`):

| Columna         | Obligatoria | Formato                              |
| --------------- | ----------- | ------------------------------------ |
| `nombre`        | Sí          |                                      |
| `apellido`      | Sí          |                                      |
| `telefono`      | Sí          | 10 dígitos; acepta `+57` y separadores |
| `email`         | No          | Si es inválido se importa sin email  |
| `fechaRegistro` | No          | `dd/mm/aaaa` o `aaaa-mm-dd`          |
| `plan`          | No          | Id o nombre del plan                 |

El botón "Descargar plantilla CSV" genera un archivo de ejemplo.

Cosas que conviene saber:

- **El teléfono es la clave para no duplicar.** Volver a subir el mismo archivo
  no crea socios repetidos: las filas cuyo teléfono ya existe se omiten.
- Las filas incompletas se rechazan y se informa de cuáles y por qué; no se
  guardan a medias.
- El detalle de filas rechazadas y avisos aparece en la consola del navegador
  (F12); en pantalla se muestra el resumen.
- Si la fila trae `plan`, se calcula el vencimiento desde `fechaRegistro` y se
  crea también el registro de pago correspondiente.

## Desplegar en GitHub Pages

1. Subir el repositorio a GitHub.
2. **Settings** → **Pages** → Source: *Deploy from a branch*.
3. Branch `main`, carpeta `/ (root)`.

`index.html` en la raíz es el punto de entrada. `npm install` no hace falta para
publicar; `node_modules/` está en el `.gitignore`.

## Limitaciones conocidas

Cosas que hoy no están resueltas, por si aparecen más adelante:

- **Sin autenticación** (ver la sección de seguridad).
- **Sin paginación.** La app escucha las colecciones completas. Va bien con
  cientos de socios; con miles habría que paginar o filtrar en el servidor.
- **Los pagos no se consultan desde ninguna pantalla.** Se guardan
  correctamente, pero no hay vista de histórico ni de ingresos.
- **Los planes no se administran desde la app**, solo desde Firebase Console.
- El logo (`assets/FD-Logo.jpeg`, 137 KB) se muestra a 40 px de alto y convendría
  optimizarlo.
