
// Tipos Base TVMaze (Existentes, no tocar para mantener compatibilidad Search)
export interface TvMazeShow {
  id: number;
  url: string;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  premiered: string | null;
  rating: {
    average: number | null;
  };
  image: {
    medium: string;
    original: string;
  } | null;
  summary: string;
}

export interface TvMazeResult {
  score: number;
  show: TvMazeShow;
}

export interface WatchlistItem {
  serie_id: number;
  titulo_formateado: string;
  es_top: boolean;
}

// === NUEVO MODELO COUCHDB ===

export type DocType = 'content' | 'person';
export type ContentType = 'MOVIE' | 'SERIE';
export type GenderType = 'HOMBRE' | 'MUJER';

export interface CouchDoc {
  _id?: string;
  _rev?: string;
  type: DocType;
}

export interface Person extends CouchDoc {
  type: 'person';
  fullName: string; // Nombre completo
  country: string;
  birthDate: string; // YYYY-MM-DD
  gender: GenderType;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
}

export interface Content extends CouchDoc {
  type: 'content';
  contentType: ContentType;
  name: string;
  genres: string[];
  premiered: string; // YYYY-MM-DD
  awards: string;
  downloads: number;
  rating: number | null;
  // Relaciones por ID (Modelo Documental)
  mainCastId: string; // _id de la Persona
  castIds: string[];  // Array de _ids de Personas
  
  // Específico Series
  seasons?: Season[];
  
  // Archivo (Simulado)
  video?: {
    url?: string;
    filename?: string;
  };
}

// Para la UI que necesita el objeto Persona completo (haciendo join en cliente)
export interface ContentPopulated extends Omit<Content, 'mainCastId' | 'castIds'> {
  actorPrincipal?: Person;
  reparto?: Person[];
  // Mantener IDs para edición
  mainCastId: string;
  castIds: string[];
}

// Alias para compatibilidad con código antiguo (si es necesario)
export type ContenidoLocal = Content;

export interface CouchDbConfig {
  host: string;
  dbName: string;
  username: string;
  password?: string;
}
