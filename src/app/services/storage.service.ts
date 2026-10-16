import { Injectable } from '@angular/core';

export interface LineaPedido {
  productoId: number;
  producto: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface PedidoGuardado {
  id: number;
  lineas?: LineaPedido[];
  total?: number;
  origen?: string;
  fecha: string;
  estado: 'PENDIENTE' | 'pendiente';
  productoId?: number;
  producto?: string;
  mensaje?: string;
}

export type NuevoPedido = Pick<PedidoGuardado, 'lineas' | 'total' | 'origen'> & {
  lineas: LineaPedido[];
  total: number;
  origen: string;
};

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly dbName = 'backusVentasDB';
  private readonly storeName = 'pedidos';

  async abrirDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir.'));
      request.onblocked = () => reject(new Error('está bloqueada por otra pestaña.'));
    });
  }

  async guardarPedido(pedido: NuevoPedido): Promise<void> {
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      let finalizado = false;
      const cerrar = () => {
        if (!finalizado) {
          finalizado = true;
          db.close();
        }
      };

      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        transaction.objectStore(this.storeName).add({
          ...pedido,
          fecha: new Date().toISOString(),
          estado: 'PENDIENTE'
        });

        transaction.oncomplete = () => {
          cerrar();
          resolve();
        };
        transaction.onerror = () => {
          cerrar();
          reject(transaction.error ?? new Error('Falló la escritura del pedido.'));
        };
        transaction.onabort = () => {
          cerrar();
          reject(transaction.error ?? new Error('Se canceló el pedido.'));
        };
      } catch (error) {
        cerrar();
        reject(error);
      }
    });
  }

  async obtenerPedidos(): Promise<PedidoGuardado[]> {
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      let finalizado = false;
      const cerrar = () => {
        if (!finalizado) {
          finalizado = true;
          db.close();
        }
      };

      try {
        const transaction = db.transaction(this.storeName, 'readonly');
        const request = transaction.objectStore(this.storeName).getAll();
        let pedidos: PedidoGuardado[] = [];

        request.onsuccess = () => {
          pedidos = request.result as PedidoGuardado[];
        };
        request.onerror = () => {
          cerrar();
          reject(request.error ?? new Error('Falló la lectura del historial.'));
        };
        transaction.oncomplete = () => {
          cerrar();
          resolve(pedidos.sort((a, b) => b.fecha.localeCompare(a.fecha)));
        };
        transaction.onerror = () => {
          cerrar();
          reject(transaction.error ?? new Error('Falló la lectura del historial.'));
        };
        transaction.onabort = () => {
          cerrar();
          reject(transaction.error ?? new Error('Se canceló la lectura del historial.'));
        };
      } catch (error) {
        cerrar();
        reject(error);
      }
    });
  }
}
