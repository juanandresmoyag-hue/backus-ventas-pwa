import { Component, OnDestroy, OnInit } from '@angular/core';
import { CatalogoService, Producto } from './services/catalogo.service';
import {
  LineaPedido,
  NuevoPedido,
  PedidoGuardado,
  StorageService
} from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  online = navigator.onLine;
  productos: Producto[] = [];
  pedidosGuardados: PedidoGuardado[] = [];
  productosEnPedidoIds: number[] = [];
  cantidades: Record<number, string> = {};
  busqueda = '';
  categoriaSeleccionada = '';
  pedidoExpandidoId: number | null = null;
  notificacion = '';
  notificacionEsError = false;
  catalogoError = '';
  pedidosError = '';
  guardando = false;
  intentoRegistrar = false;

  private readonly actualizarEstadoOnline = () => {
    this.online = true;
  };

  private readonly actualizarEstadoOffline = () => {
    this.online = false;
  };

  constructor(
    private readonly catalogoService: CatalogoService,
    private readonly storageService: StorageService
  ) {
    window.addEventListener('online', this.actualizarEstadoOnline);
    window.addEventListener('offline', this.actualizarEstadoOffline);
  }

  get categorias(): string[] {
    return [...new Set(this.productos.map((producto) => producto.categoria))].sort();
  }

  get productosFiltrados(): Producto[] {
    // La búsqueda normalizada y la categoría se combinan para filtrar el catálogo.
    const texto = this.busqueda.trim().toLocaleLowerCase();
    return this.productos.filter((producto) => {
      const coincideNombre = producto.producto.toLocaleLowerCase().includes(texto);
      const coincideCategoria = !this.categoriaSeleccionada
        || producto.categoria === this.categoriaSeleccionada;
      return coincideNombre && coincideCategoria;
    });
  }

  get lineasResumen(): LineaPedido[] {
    // Solo las cantidades enteras positivas forman parte del total del pedido.
    return this.productosEnPedido.flatMap((producto) => {
      const valor = this.cantidades[producto.id] ?? '';
      if (!this.esCantidadValida(valor)) {
        return [];
      }

      const cantidad = Number(valor);
      return [{
        productoId: producto.id,
        producto: producto.producto,
        precioUnitario: producto.precio,
        cantidad,
        subtotal: producto.precio * cantidad
      }];
    });
  }

  get hayCantidadesInvalidas(): boolean {
    return this.productosEnPedido.some((producto) => {
      const valor = this.cantidades[producto.id] ?? '';
      return !this.esCantidadValida(valor);
    });
  }

  get productosEnPedido(): Producto[] {
    return this.productosEnPedidoIds.flatMap((productoId) => {
      const producto = this.productos.find((item) => item.id === productoId);
      return producto ? [producto] : [];
    });
  }

  get totalPedido(): number {
    return this.lineasResumen.reduce((total, linea) => total + linea.subtotal, 0);
  }

  ngOnInit(): void {
    void this.cargarPedidosGuardados();
    this.catalogoService.obtenerCatalogo().subscribe({
      next: (productos) => {
        this.productos = productos;
      },
      error: () => {
        this.catalogoError = 'No se pudo cargar el catálogo. Intenta nuevamente más tarde.';
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.actualizarEstadoOnline);
    window.removeEventListener('offline', this.actualizarEstadoOffline);
  }

  actualizarBusqueda(event: Event): void {
    this.busqueda = (event.target as HTMLInputElement).value;
  }

  actualizarCategoria(event: Event): void {
    this.categoriaSeleccionada = (event.target as HTMLSelectElement).value;
  }

  cantidad(productoId: number): string {
    return this.cantidades[productoId] ?? '';
  }

  agregarProducto(productoId: number): void {
    const cantidadActual = this.cantidad(productoId);
    if (!this.productosEnPedidoIds.includes(productoId)) {
      this.productosEnPedidoIds = [...this.productosEnPedidoIds, productoId];
      this.cantidades[productoId] = '1';
      return;
    }

    if (this.esCantidadValida(cantidadActual)) {
      const cantidad = Number(cantidadActual);
      if (cantidad < Number.MAX_SAFE_INTEGER) {
        this.cantidades[productoId] = String(cantidad + 1);
      }
    }
  }

  manejarTecladoProducto(event: KeyboardEvent, productoId: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.agregarProducto(productoId);
    }
  }

  actualizarCantidad(productoId: number, event: Event): void {
    this.cantidades[productoId] = (event.target as HTMLInputElement).value;
    this.notificacion = '';
  }

  subtotalProducto(productoId: number): number {
    const producto = this.productos.find((item) => item.id === productoId);
    const cantidad = this.cantidad(productoId);
    return producto && this.esCantidadValida(cantidad)
      ? producto.precio * Number(cantidad)
      : 0;
  }

  quitarProducto(productoId: number): void {
    this.productosEnPedidoIds = this.productosEnPedidoIds.filter((id) => id !== productoId);
    const cantidadesRestantes = { ...this.cantidades };
    delete cantidadesRestantes[productoId];
    this.cantidades = cantidadesRestantes;
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.categoriaSeleccionada = '';
  }

  async registrarPedido(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.intentoRegistrar = true;
    this.notificacion = '';
    this.notificacionEsError = false;

    if (this.guardando) {
      return;
    }
    if (this.hayCantidadesInvalidas) {
      this.mostrarError('Revisa las cantidades: ingresa solo números enteros mayores que cero.');
      return;
    }

    const lineas = this.lineasResumen;
    if (this.productosEnPedidoIds.length === 0 || lineas.length === 0) {
      this.mostrarError('Agrega al menos un producto con una cantidad válida para registrar el pedido.');
      return;
    }

    const pedido: NuevoPedido = {
      lineas,
      total: lineas.reduce((total, linea) => total + linea.subtotal, 0),
      origen: 'DISPOSITIVO'
    };

    this.guardando = true;
    try {
      // El mensaje de éxito se asigna únicamente después de confirmar la escritura local.
      await this.storageService.guardarPedido(pedido);
      this.notificacion = this.online
        ? 'Pedido guardado en este dispositivo; no fue enviado al servidor porque no hay una API configurada.'
        : 'Pedido guardado en este dispositivo y pendiente; no fue enviado al servidor porque no hay conexión ni API configurada.';
      this.cantidades = {};
      this.productosEnPedidoIds = [];
      this.intentoRegistrar = false;
      await this.cargarPedidosGuardados();
    } catch {
      this.mostrarError('No se pudo guardar el pedido en este dispositivo. Verifica el almacenamiento e inténtalo nuevamente.');
    } finally {
      this.guardando = false;
    }
  }

  alternarDetalle(pedidoId: number): void {
    this.pedidoExpandidoId = this.pedidoExpandidoId === pedidoId ? null : pedidoId;
  }

  esCantidadValida(valor: string | undefined): boolean {
    if (!valor || !/^[1-9]\d*$/.test(valor)) {
      return false;
    }
    return Number.isSafeInteger(Number(valor));
  }

  cantidadInvalida(valor: string | undefined): boolean {
    return valor !== undefined && !this.esCantidadValida(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  lineasPedido(pedido: PedidoGuardado): LineaPedido[] {
    if (pedido.lineas) {
      return pedido.lineas;
    }

    // Conserva visible el historial guardado por versiones anteriores de la aplicación.
    if (pedido.producto) {
      return [{
        productoId: pedido.productoId ?? pedido.id,
        producto: pedido.producto,
        precioUnitario: 0,
        cantidad: 1,
        subtotal: 0
      }];
    }
    return [];
  }

  private mostrarError(mensaje: string): void {
    this.notificacion = mensaje;
    this.notificacionEsError = true;
  }

  private async cargarPedidosGuardados(): Promise<void> {
    this.pedidosError = '';
    try {
      this.pedidosGuardados = await this.storageService.obtenerPedidos();
    } catch {
      this.pedidosError = 'No se pudo leer el historial local';
    }
  }
}
