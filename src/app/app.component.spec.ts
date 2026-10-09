import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { CatalogoService } from './services/catalogo.service';
import { StorageService } from './services/storage.service';

describe('AppComponent', () => {
  beforeEach(async () => {
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
            guardarPedido: () => Promise.resolve(),
            obtenerPedidos: () => Promise.resolve([])
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'backus-ventas-pwa' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('backus-ventas-pwa');
  });

  it('should render the connected catalog and saved orders section without the old heading', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')).toBeNull();
    expect(compiled.textContent).toContain('Cristal 620 ml');
    expect(compiled.textContent).toContain('CONECTADO');
    expect(compiled.textContent).toContain('Pedidos guardados');
  });

  it('should show the saved orders when offline', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.online = false;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.pedidosGuardados = [{
      id: 1,
      productoId: 1,
      producto: 'Cristal 620 ml',
      mensaje: '',
      fecha: '2026-10-09T00:00:00.000Z',
      estado: 'pendiente'
    }];
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('SIN CONEXIÓN');
    expect(compiled.textContent).toContain('Cristal 620 ml');
    expect(compiled.textContent).toContain('Estado: PENDIENTE');
  });
});
