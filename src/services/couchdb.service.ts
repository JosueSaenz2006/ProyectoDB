
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { CouchDoc, CouchDbConfig } from '../models/types';
import { StorageService, MultiDbConfig } from './storage.service';

// Tipo para especificar la base de datos destino
export type TargetDatabase = 'actores' | 'series' | 'peliculas' | 'descripcion' | 'watchlist' | 'usuarios';

@Injectable({
  providedIn: 'root'
})
export class CouchDbService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);

  // Configuración multi-BD
  private get config(): MultiDbConfig {
    return this.storage.getMultiDbConfig();
  }

  // Obtiene la URL completa para una BD específica
  private getDbUrl(target: TargetDatabase): string {
    const cfg = this.config;
    const dbName = cfg.databases[target];
    return `${cfg.host}/${dbName}`;
  }

  // URL legacy (para compatibilidad con código existente que usa series_db por defecto)
  private get URL(): string {
    return this.getDbUrl('series');
  }

  private getHeaders(): HttpHeaders {
    const c = this.config;
    const auth = btoa(`${c.username}:${c.password}`);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
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

  // === CRUD CON BASE DE DATOS ESPECÍFICA ===

  // Listar documentos por tipo en una BD específica
  listByTypeIn<T>(db: TargetDatabase, typeFilter?: string): Observable<{ docs: T[] }> {
    const query: any = { selector: {}, limit: 100 };
    if (typeFilter) {
      query.selector.type = typeFilter;
    }
    return this.http.post<{ docs: T[] }>(`${this.getDbUrl(db)}/_find`, query, { headers: this.getHeaders() });
  }

  // Obtener documento de una BD específica
  getFrom<T>(db: TargetDatabase, id: string): Observable<T> {
    return this.http.get<T>(`${this.getDbUrl(db)}/${id}`, { headers: this.getHeaders() });
  }

  // Crear documento en una BD específica
  createIn<T extends CouchDoc>(db: TargetDatabase, doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    return this.http.post<{ ok: boolean, id: string, rev: string }>(this.getDbUrl(db), doc, { headers: this.getHeaders() });
  }

  // Actualizar documento en una BD específica
  updateIn<T extends CouchDoc>(db: TargetDatabase, doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    if (!doc._id || !doc._rev) throw new Error('Update requiere _id y _rev');
    return this.http.put<{ ok: boolean, id: string, rev: string }>(`${this.getDbUrl(db)}/${doc._id}`, doc, { headers: this.getHeaders() });
  }

  // Eliminar documento de una BD específica
  deleteFrom(db: TargetDatabase, id: string, rev: string): Observable<{ ok: boolean, rev: string }> {
    return this.http.delete<{ ok: boolean, rev: string }>(`${this.getDbUrl(db)}/${id}?rev=${rev}`, { headers: this.getHeaders() });
  }

  // Mango Query en una BD específica
  findIn<T>(db: TargetDatabase, selector: any, sort?: any[]): Observable<{ docs: T[] }> {
    const body: any = { selector, limit: 100 };
    if (sort) body.sort = sort;
    return this.http.post<{ docs: T[] }>(`${this.getDbUrl(db)}/_find`, body, { headers: this.getHeaders() });
  }

  // === MÉTODOS LEGACY (compatibilidad con código existente) ===

  listByType<T>(type: string): Observable<{ docs: T[] }> {
    return this.listByTypeIn<T>('series', type);
  }

  get<T>(id: string): Observable<T> {
    return this.getFrom<T>('series', id);
  }

  create<T extends CouchDoc>(doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    return this.createIn<T>('series', doc);
  }

  update<T extends CouchDoc>(doc: T): Observable<{ ok: boolean, id: string, rev: string }> {
    return this.updateIn<T>('series', doc);
  }

  delete(id: string, rev: string): Observable<{ ok: boolean, rev: string }> {
    return this.deleteFrom('series', id, rev);
  }

  find<T>(selector: any, sort?: any[]): Observable<{ docs: T[] }> {
    return this.findIn<T>('series', selector, sort);
  }

  // View Query (usa series_db por defecto)
  view<T>(designDoc: string, viewName: string, params: any = {}): Observable<T> {
    let url = `${this.URL}/_design/${designDoc}/_view/${viewName}`;

    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
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
      await firstValueFrom(this.http.get(config.host, this.getOptions(config)));

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

  // Probar conexión a todas las BDs
  async testAllDatabases(): Promise<{ success: boolean, results: { db: string, ok: boolean }[] }> {
    const cfg = this.config;
    const databases: TargetDatabase[] = ['actores', 'series', 'peliculas', 'descripcion', 'watchlist', 'usuarios'];
    const results: { db: string, ok: boolean }[] = [];

    for (const db of databases) {
      try {
        await firstValueFrom(this.http.get(this.getDbUrl(db), { headers: this.getHeaders() }));
        results.push({ db: cfg.databases[db], ok: true });
      } catch {
        results.push({ db: cfg.databases[db], ok: false });
      }
    }

    const allOk = results.every(r => r.ok);
    return { success: allOk, results };
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
      let rev: string | undefined;
      try {
        const current: any = await firstValueFrom(this.http.get(url, options));
        rev = current._rev;
      } catch (e) { }

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
