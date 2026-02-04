
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
  // Campos extendidos
  name: string;           // Nombre original
  image?: string;         // URL del poster
  summaryEs?: string;     // Sinopsis en español
  genres?: string[];      // Géneros traducidos
  rating?: number;        // Calificación original (TVMaze)
  videoId?: string;       // ID del video principal de YouTube
  videos?: { id: string; title?: string }[]; // Múltiples videos
  premiered?: string;     // Fecha de estreno
  downloads?: number;     // Contador de visualizaciones
  // Campos personales
  myRating?: number;      // Calificación personal (1-10)
  myReview?: string;      // Reseña/comentario personal
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
  image?: string; // URL de foto del actor
  bio?: string;   // Biografía generada
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
  awards: string[]; // Array de premios (ej: ["Oscar", "Emmy"])
  downloads: number;
  rating: number | null;
  // Relaciones por ID (Modelo Documental)
  mainCastId: string; // _id de la Persona
  castIds: string[];  // Array de _ids de Personas

  // Específico Series
  seasons?: Season[];

  // Múltiples videos (YouTube, etc.)
  videos?: VideoLink[];

  // Video principal (compatibilidad)
  video?: {
    url?: string;
    filename?: string;
  };
  image?: string; // URL de la imagen (poster)
}

// Link de video con metadatos
export interface VideoLink {
  id: string;        // ID único del video (ej: YouTube ID)
  platform: 'youtube' | 'vimeo' | 'other';
  title?: string;    // Título descriptivo
  addedAt: string;   // Fecha de agregado ISO
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

// === MODELO PELICULAS_DB (CouchDB) ===
// Formato de documentos en la base de datos peliculas_db

// Tipo de documento: 'movie' o 'series'
export type PeliculasDbType = 'movie' | 'series';

// Género del actor/actriz
export type ActorGender = 'HOMBRE' | 'MUJER';

// Cast member en una película/serie
// Incluye información completa del actor: nombre, país, fecha de nacimiento, género
export interface CastMember {
  name: string;           // Nombre completo del actor/actriz
  role: string;           // Rol/personaje en la película/serie
  country?: string;       // País de origen del actor
  birthDate?: string;     // Fecha de nacimiento (YYYY-MM-DD)
  gender?: ActorGender;   // Género: HOMBRE o MUJER
  isMainCast?: boolean;   // true si es el actor/actriz principal
}

// Temporada de una serie
export interface SeasonInfo {
  seasonNumber: number;
  episodesCount: number;
}

// Archivo de video asociado a la película/serie
export interface VideoFile {
  url?: string;           // URL del archivo de video
  filename?: string;      // Nombre del archivo
  format?: string;        // Formato del video (mp4, mkv, etc.)
  sizeBytes?: number;     // Tamaño en bytes
}

// Documento base de películas/series
export interface PeliculaDoc {
  _id: string;            // formato: "title:nombre_en_snake_case"
  _rev?: string;
  type: PeliculasDbType;
  name: string;
  genres: string[];
  releaseDate: string;    // formato: "YYYY-MM-DD"
  awards: string[];
  downloads: number;
  cast: CastMember[];     // Reparto con información completa de actores
  createdAt: string;      // formato ISO 8601
  // Archivo de video:
  video?: VideoFile;
  // Solo para series:
  seasons?: SeasonInfo[];
  // Solo para películas:
  durationMinutes?: number;
}

// Respuesta de las vistas de CouchDB
export interface ViewRow<T> {
  id: string;
  key: any;
  value: T;
  doc?: PeliculaDoc;
}

export interface ViewResponse<T> {
  total_rows: number;
  offset: number;
  rows: ViewRow<T>[];
}
