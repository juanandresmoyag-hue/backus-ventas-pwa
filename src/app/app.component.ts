import { Component, OnDestroy, OnInit } from '@angular/core';
import { CatalogoService, Producto } from './services/catalogo.service';
import { PedidoGuardado, StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'backus-ventas-pwa';
  online = navigator.onLine;
  productos: Producto[] = [];
  pedidosGuardados: PedidoGuardado[] = [];
  productoSeleccionadoId: number | null = null;
  mostrarFormulario = true;
  mensaje = '';
  notificacion = '';
  catalogoError = '';
  pedidosError = '';
  guardando = false;

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

  ngOnInit(): void {
    void this.cargarPedidosGuardados();
    this.catalogoService.obtenerCatalogo().subscribe({
      next: (productos) => {
        this.productos = productos;
        this.productoSeleccionadoId = productos[0]?.id ?? null;
      },
      error: () => {
        this.catalogoError = 'No se pudo cargar el catálogo.';
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.actualizarEstadoOnline);
    window.removeEventListener('offline', this.actualizarEstadoOffline);
  }

  seleccionarProducto(productoId: number): void {
    this.productoSeleccionadoId = productoId;
  }

  actualizarMensaje(event: Event): void {
    this.mensaje = (event.target as HTMLInputElement).value;
  }

  async registrarPedido(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const producto = this.productos.find(
      (item) => item.id === this.productoSeleccionadoId
    );
    if (!producto || this.guardando) {
      return;
    }

    this.guardando = true;
    this.notificacion = '';

    try {
      await this.storageService.guardarPedido({
        productoId: producto.id,
        producto: producto.producto,
        mensaje: this.mensaje
      });
      this.notificacion = 'Pedido guardado localmente · Estado: PENDIENTE';
      this.mensaje = '';
      await this.cargarPedidosGuardados();
    } catch {
      this.notificacion = 'No se pudo guardar el pedido. Inténtalo nuevamente.';
    } finally {
      this.guardando = false;
    }
  }

  private async cargarPedidosGuardados(): Promise<void> {
    this.pedidosError = '';

    try {
      this.pedidosGuardados = await this.storageService.obtenerPedidos();
    } catch {
      this.pedidosError = 'No se pudieron cargar los pedidos guardados.';
    }
  }
}
