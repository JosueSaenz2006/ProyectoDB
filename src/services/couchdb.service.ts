
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { CouchDoc, CouchDbConfig } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class CouchDbService {
  private http = inject(HttpClient);
  
  // Configuración Hardcoded para la evaluación (en prod iría en environment)
  // Se mantiene como fallback, aunque la SettingsComponent usa config dinámica.
  private readonly URL = 'http://localhost:5984/streaming_db';
  private readonly AUTH = btoa('admin:password');

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Basic ${this.AUTH}`
    });
  }

  // Helper para configuración dinámica desde Settings
  private getOptions(config: CouchDbConfig) {
    const auth = btoa(`${config.username}:${config.password || ''}`);
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      })
    };
  }

  // === CRUD GENÉRICO ===

  // Listar todos los documentos por tipo (usando Mango)
  listByType<T>(type: string): Observable<{ docs: T[] }> {
    const query = {
      selector: { type: type },
      limit: 100
    };
    return this.http.post<{ docs: T[] }>(`${this.URL}/_find`, query, { headers: this.getHeaders() });
  }

  get<T>(id: string): Observable<T> {
    return this.http.get<T>(`${this.URL}/${id}`, { headers: this.getHeaders() });
  }

  create<T extends CouchDoc>(doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    // CouchDB genera ID si no viene, o usa el _id si viene
    return this.http.post<{ ok: boolean, id: string, rev: string }>(this.URL, doc, { headers: this.getHeaders() });
  }

  update<T extends CouchDoc>(doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    if (!doc._id || !doc._rev) throw new Error('Update requiere _id y _rev');
    return this.http.put<{ ok: boolean, id: string, rev: string }>(`${this.URL}/${doc._id}`, doc, { headers: this.getHeaders() });
  }

  delete(id: string, rev: string): Observable<{ ok: boolean, rev: string }> {
    return this.http.delete<{ ok: boolean, rev: string }>(`${this.URL}/${id}?rev=${rev}`, { headers: this.getHeaders() });
  }

  // === QUERIES AVANZADOS ===

  // Mango Query Genérico
  find<T>(selector: any, sort?: any[]): Observable<{ docs: T[] }> {
    const body: any = { selector, limit: 100 };
    if (sort) body.sort = sort;
    return this.http.post<{ docs: T[] }>(`${this.URL}/_find`, body, { headers: this.getHeaders() });
  }

  // View Query
  view<T>(designDoc: string, viewName: string, params: any = {}): Observable<T> {
    let url = `${this.URL}/_design/${designDoc}/_view/${viewName}`;
    
    // Serializar params
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      // CouchDB requiere que las keys complejas sean JSON stringified
      const val = typeof params[key] === 'object' || key === 'key' || key === 'startkey' || key === 'endkey' 
        ? JSON.stringify(params[key]) 
        : params[key];
      queryParams.append(key, val);
    });

    return this.http.get<T>(`${url}?${queryParams.toString()}`, { headers: this.getHeaders() });
  }

  // === SETTINGS / ADMIN METHODS ===

  async testConnection(config: CouchDbConfig): Promise<{ success: boolean, message: string }> {
    try {
      // Probar conexión al host (Root)
      await firstValueFrom(this.http.get(config.host, this.getOptions(config)));
      
      // Probar existencia de la BD
      try {
        await firstValueFrom(this.http.get(`${config.host}/${config.dbName}`, this.getOptions(config)));
        return { success: true, message: 'Conexión exitosa y Base de Datos encontrada.' };
      } catch (e: any) {
        if (e.status === 404) {
          return { success: false, message: 'Conexión al servidor OK, pero la Base de Datos no existe.' };
        }
        throw e;
      }
    } catch (e: any) {
      return { success: false, message: `Error de conexión: ${e.message || e.statusText}` };
    }
  }

  async createDatabase(config: CouchDbConfig): Promise<boolean> {
    try {
       await firstValueFrom(this.http.put(`${config.host}/${config.dbName}`, {}, this.getOptions(config)));
       return true;
    } catch (e) {
       console.error('Error creating database:', e);
       return false;
    }
  }

  async uploadBackup(config: CouchDbConfig, catalogo: any[], watchlist: any[]): Promise<boolean> {
    const docId = 'backup_data';
    const url = `${config.host}/${config.dbName}/${docId}`;
    const options = this.getOptions(config);

    try {
      // Intentar obtener el documento existente para obtener el _rev
      let rev: string | undefined;
      try {
        const current: any = await firstValueFrom(this.http.get(url, options));
        rev = current._rev;
      } catch (e) {
        // No existe, se creará uno nuevo
      }

      const backupDoc = {
        _id: docId,
        _rev: rev,
        type: 'backup',
        catalogo,
        watchlist,
        timestamp: new Date().toISOString()
      };

      await firstValueFrom(this.http.put(url, backupDoc, options));
      return true;
    } catch (e) {
      console.error('Error uploading backup:', e);
      return false;
    }
  }

  async downloadBackup(config: CouchDbConfig): Promise<{ catalogo: any[], watchlist: any[] } | null> {
    try {
       const url = `${config.host}/${config.dbName}/backup_data`;
       const doc: any = await firstValueFrom(this.http.get(url, this.getOptions(config)));
       return { catalogo: doc.catalogo || [], watchlist: doc.watchlist || [] };
    } catch (e) {
      console.error('Error downloading backup:', e);
      return null;
    }
  }
}
