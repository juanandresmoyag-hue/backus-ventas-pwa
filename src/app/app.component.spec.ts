import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { CatalogoService } from './services/catalogo.service';
import { StorageService } from './services/storage.service';

describe('AppComponent', () => {
  let guardarPedido: jasmine.Spy;

  beforeEach(async () => {
    guardarPedido = jasmine.createSpy('guardarPedido').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: CatalogoService,
          useValue: {
            obtenerCatalogo: () => of([
              { id: 1, producto: 'Cristal 620 ml', categoria: 'Cerveza', precio: 7.5 },
              { id: 2, producto: 'Pilsen Callao 620 ml', categoria: 'Cerveza', precio: 8 },
              { id: 3, producto: 'Cusqueña 620 ml', categoria: 'Cerveza', precio: 9 }
            ])
          }
        },
        {
          provide: StorageService,
          useValue: {
            guardarPedido,
            obtenerPedidos: () => Promise.resolve([])
          }
        }
      ]
    }).compileComponents();
  });

  async function crearComponente() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show a friendly order page and explain local-only saving', async () => {
    const fixture = await crearComponente();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Pedidos');
    expect(compiled.textContent).toContain('Con conexión');
    expect(compiled.textContent).toContain('No hay una API configurada');
    expect(compiled.textContent).toContain('Historial de pedidos');
  });

  it('filters product names without case sensitivity and clears filters', async () => {
    const fixture = await crearComponente();
    const app = fixture.componentInstance;
    app.busqueda = 'pIlSeN';
    expect(app.productosFiltrados.map((producto) => producto.id)).toEqual([2]);

    app.categoriaSeleccionada = 'Cerveza';
    app.limpiarFiltros();
    expect(app.busqueda).toBe('');
    expect(app.categoriaSeleccionada).toBe('');
    expect(app.productosFiltrados.length).toBe(3);
  });

  it('does not save zero or non-integer quantities', async () => {
    const fixture = await crearComponente();
    const app = fixture.componentInstance;
    app.cantidades[1] = '1.5';
    const preventDefault = jasmine.createSpy('preventDefault');

    await app.registrarPedido({ preventDefault } as unknown as SubmitEvent);
    app.cantidades[1] = '0';
    await app.registrarPedido({ preventDefault } as unknown as SubmitEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(guardarPedido).not.toHaveBeenCalled();
    expect(app.notificacionEsError).toBeTrue();
    expect(app.notificacion).toContain('enteros mayores que cero');
  });

  it('rejects an empty order', async () => {
    const fixture = await crearComponente();
    const app = fixture.componentInstance;

    await app.registrarPedido({ preventDefault: () => undefined } as SubmitEvent);

    expect(guardarPedido).not.toHaveBeenCalled();
    expect(app.notificacionEsError).toBeTrue();
    expect(app.notificacion).toContain('Agrega al menos un producto');
  });

  it('saves line items and the correct total before showing local-only success', async () => {
    const fixture = await crearComponente();
    const app = fixture.componentInstance;
    app.cantidades[1] = '2';
    app.cantidades[3] = '1';

    await app.registrarPedido({ preventDefault: () => undefined } as SubmitEvent);

    expect(guardarPedido).toHaveBeenCalledWith({
      origen: 'DISPOSITIVO',
      total: 24,
      lineas: [
        {
          productoId: 1,
          producto: 'Cristal 620 ml',
          precioUnitario: 7.5,
          cantidad: 2,
          subtotal: 15
        },
        {
          productoId: 3,
          producto: 'Cusqueña 620 ml',
          precioUnitario: 9,
          cantidad: 1,
          subtotal: 9
        }
      ]
    });
    expect(app.notificacionEsError).toBeFalse();
    expect(app.notificacion).toContain('No se envió al servidor');
    expect(app.cantidades).toEqual({});
  });

  it('does not show success when persistence fails', async () => {
    guardarPedido.and.rejectWith(new Error('IndexedDB unavailable'));
    const fixture = await crearComponente();
    const app = fixture.componentInstance;
    app.cantidades[1] = '1';

    await app.registrarPedido({ preventDefault: () => undefined } as SubmitEvent);

    expect(app.notificacionEsError).toBeTrue();
    expect(app.notificacion).toContain('No se pudo guardar');
  });

  it('shows the local history while offline', async () => {
    const fixture = await crearComponente();
    const app = fixture.componentInstance;
    app.online = false;
    app.pedidosGuardados = [{
      id: 1,
      lineas: [{
        productoId: 1,
        producto: 'Cristal 620 ml',
        precioUnitario: 7.5,
        cantidad: 2,
        subtotal: 15
      }],
      total: 15,
      origen: 'DISPOSITIVO',
      fecha: '2026-10-09T00:00:00.000Z',
      estado: 'PENDIENTE'
    }];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Sin conexión');
    expect(compiled.textContent).toContain('Pedido #1');
    expect(compiled.textContent).toContain('PENDIENTE');

    app.alternarDetalle(1);
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Cristal 620 ml');
    expect(compiled.textContent).toContain('2 × S/ 7.50');
  });
});
