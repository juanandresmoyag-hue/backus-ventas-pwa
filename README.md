# Backus Ventas PWA

Aplicación web progresiva para consultar un catálogo, armar pedidos y guardarlos
localmente en el dispositivo. No hay una API de pedidos configurada: registrar un
pedido **no lo envía a un servidor**.

## Recorrido de la aplicación

1. Angular inicia la aplicación desde [`src/main.ts`](src/main.ts) y monta
   [`AppComponent`](src/app/app.component.ts).
2. `AppComponent` solicita el catálogo a `CatalogoService` y carga el historial
   desde `StorageService`.
3. El usuario filtra el catálogo y pulsa una fila para agregar un producto. La
   primera pulsación agrega una unidad; pulsaciones adicionales aumentan su
   cantidad.
4. El resumen permite editar la cantidad o quitar líneas. Los subtotales y el
   total se actualizan con las cantidades válidas.
5. Al registrar, la aplicación valida el pedido y lo almacena en IndexedDB. El
   historial se vuelve a leer desde la base local y muestra el nuevo pedido.

## Código principal

### Interfaz y lógica del pedido

[`src/app/app.component.ts`](src/app/app.component.ts) contiene el componente
principal y el estado de la vista:

- **Catálogo y filtros:** `productos`, `busqueda`, `categoriaSeleccionada`,
  `categorias` y `productosFiltrados`. La búsqueda compara nombres sin
  distinguir mayúsculas/minúsculas; el filtro de categoría se combina con ella.
  `limpiarFiltros()` restablece ambos filtros.

- **Agregar productos:** `productosEnPedidoIds` mantiene los identificadores de
  las líneas agregadas y `cantidades` guarda su cantidad como texto mientras se
  edita. `agregarProducto()` inicia una línea con cantidad 1 o incrementa su
  cantidad. `manejarTecladoProducto()` permite ejecutar la misma acción con
  Enter o espacio.

- **Editar el resumen:** `actualizarCantidad()` actualiza la cantidad;
  `quitarProducto()` elimina la línea y su cantidad; `subtotalProducto()`
  calcula el subtotal de una línea.

- **Validación y cálculos:** `esCantidadValida()` acepta únicamente enteros
  positivos representables con seguridad. `lineasResumen` construye las líneas
  válidas con producto, precio unitario, cantidad y subtotal. `totalPedido`
  suma sus subtotales. `registrarPedido()` impide guardar pedidos vacíos o con
  cantidades inválidas.

- **Persistencia y mensajes:** `registrarPedido()` llama a
  `StorageService.guardarPedido()`. Solo después de completar el guardado limpia
  el formulario y muestra confirmación local. Si falla IndexedDB, muestra un
  error y no confirma el éxito. El mensaje aclara que no hay envío al servidor.

- **Conectividad e historial:** los eventos `online` y `offline` actualizan el
  indicador de conexión. `cargarPedidosGuardados()` lee el historial,
  `alternarDetalle()` abre o cierra el detalle y `formatearFecha()` presenta la
  fecha en formato local. `lineasPedido()` permite mostrar también pedidos
  guardados por una versión anterior.

[`src/app/app.component.html`](src/app/app.component.html) conecta el estado y
los métodos del componente con los controles de pantalla. Cada fila del
catálogo funciona como botón para agregar; el resumen contiene los campos
editables de cantidad, el subtotal y la acción para quitar una línea. También
muestra el indicador de conexión, mensajes, el total y el historial.

[`src/app/app.component.scss`](src/app/app.component.scss) define la apariencia
de la pantalla. En pantallas anchas presenta catálogo y resumen en dos columnas;
en móviles adapta las tablas a tarjetas y conserva un flujo vertical sin
desbordamiento horizontal.

### Catálogo

[`src/app/services/catalogo.service.ts`](src/app/services/catalogo.service.ts)
define la interfaz `Producto` (`id`, `producto`, `categoria` y `precio`) y usa
`HttpClient` para solicitar el catálogo.

Los productos editables están en
[`src/assets/data/catalogo.json`](src/assets/data/catalogo.json). Para agregar
uno, añade una entrada JSON con un `id` único, nombre, categoría y precio
numérico. `CatalogoService` obtiene ese archivo desde
`/assets/data/catalogo.json`.

### Almacenamiento local de pedidos

[`src/app/services/storage.service.ts`](src/app/services/storage.service.ts)
contiene los tipos de datos y las operaciones de IndexedDB:

- `LineaPedido`: identificador y nombre del producto, precio unitario, cantidad
  y subtotal.

- `NuevoPedido`: líneas, total y origen que se reciben al guardar.

- `PedidoGuardado`: los datos guardados junto con identificador automático,
  fecha y estado.

- `abrirDB()`: abre la base `backusVentasDB` y crea el almacén `pedidos` si aún
  no existe. La base y el almacén mantienen la versión 1 para conservar los
  pedidos ya guardados.

- `guardarPedido()`: añade el pedido en una transacción de escritura con la fecha
  actual y estado inicial `PENDIENTE`. Resuelve solo cuando termina la
  transacción; rechaza ante errores o cancelaciones.
  
- `obtenerPedidos()`: lee los registros del almacén y devuelve el historial del
  más reciente al más antiguo.

Los pedidos permanecen en el almacenamiento del navegador y no se sincronizan
automáticamente con un backend.

### Configuración PWA

[`src/app/app.config.ts`](src/app/app.config.ts) registra los proveedores de
HTTP, rutas y Angular Service Worker. El service worker se habilita fuera del
modo de desarrollo.

[`ngsw-config.json`](ngsw-config.json) describe los archivos de la aplicación y
los recursos que se pueden almacenar en caché. El grupo `app` precarga el shell
de la aplicación y el grupo `assets` almacena recursos bajo `/assets/` cuando
se solicitan, con actualización posterior. El catálogo JSON está dentro de
`/assets/`; el historial de pedidos, por separado, se guarda en IndexedDB.

## Ejecutar y compilar

Instala las dependencias con `npm install` y luego:

```bash
npm start
```

Abre `http://localhost:4200/`. El servidor de desarrollo no registra el service
worker de Angular.

Para compilar:

```bash
npm run build
```

La salida se genera en `dist/backus-ventas-pwa/`. La compilación de producción
incluye la configuración del service worker. Para comprobar el comportamiento
PWA fuera de desarrollo, sirve esa compilación desde un origen seguro
(HTTPS; `localhost` también es válido).

## Pruebas

Ejecuta `npm test` para lanzar las pruebas configuradas con Karma y Jasmine.
Las pruebas unitarias del catálogo y almacenamiento se encuentran en
[`src/app/services/catalogo.service.spec.ts`](src/app/services/catalogo.service.spec.ts)
y [`src/app/services/storage.service.spec.ts`](src/app/services/storage.service.spec.ts).
Actualmente no hay un archivo de pruebas para el componente principal.
