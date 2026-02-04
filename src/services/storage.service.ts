import { Injectable } from '@angular/core';

// Nombres de las bases de datos
export type DatabaseName = 'actores_db' | 'series_db' | 'peliculas_db' | 'descripcion_db' | 'watchlist_db' | 'usuarios_db';

export interface MultiDbConfig {
  host: string;
  username: string;
  password: string;
  databases: {
    actores: string;      // actores_db
    series: string;       // series_db
    peliculas: string;    // peliculas_db
    descripcion: string;  // descripcion_db
    watchlist: string;    // watchlist_db
    usuarios: string;     // usuarios_db
  };
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  getItem<T>(key: string): T | null {
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch (e) {
      console.error(`Error parsing key ${key}`, e);
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving key ${key}`, e);
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  // === CouchDB Multi-Database Configuration ===
  private readonly COUCHDB_CONFIG_KEY = 'couchdb_multi_config';

  private readonly DEFAULT_MULTI_CONFIG: MultiDbConfig = {
    host: 'http://localhost:5984',
    username: 'admin',
    password: 'admin',
    databases: {
      actores: 'actores_db',
      series: 'series_db',
      peliculas: 'peliculas_db',
      descripcion: 'descripcion_db',
      watchlist: 'watchlist_db',
      usuarios: 'usuarios_db'
    }
  };

  getMultiDbConfig(): MultiDbConfig {
    const saved = this.getItem<MultiDbConfig>(this.COUCHDB_CONFIG_KEY);
    return saved || { ...this.DEFAULT_MULTI_CONFIG };
  }

  setMultiDbConfig(config: MultiDbConfig): void {
    this.setItem(this.COUCHDB_CONFIG_KEY, config);
  }

  resetMultiDbConfig(): void {
    this.removeItem(this.COUCHDB_CONFIG_KEY);
  }

  // === Legacy compatibility (para Settings page actual) ===
  getCouchDbConfig(): { host: string; dbName: string; username: string; password: string } {
    const multi = this.getMultiDbConfig();
    return {
      host: multi.host,
      dbName: multi.databases.series, // Default a series para compatibilidad
      username: multi.username,
      password: multi.password
    };
  }

  setCouchDbConfig(config: { host: string; dbName: string; username: string; password: string }): void {
    const multi = this.getMultiDbConfig();
    multi.host = config.host;
    multi.username = config.username;
    multi.password = config.password;
    this.setMultiDbConfig(multi);
  }

  resetCouchDbConfig(): void {
    this.resetMultiDbConfig();
  }
}
