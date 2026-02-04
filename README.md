# 🎬 MegaBuscador TV - Sistema de Gestión de Películas y Series

## Información del Proyecto

| Campo | Valor |
|-------|-------|
| **Materia** | Gestión de Bases de Datos |
| **Tema** | Bases de Datos No Relacionales (NoSQL) |
| **Docente** | Germán Parra |
| **Tipo de BD** | Almacén de Documentos |
| **Manejador** | Apache CouchDB 3.x |
| **Framework** | Angular 19 + TypeScript |

---

## 📋 Índice

1. [Problema Elegido](#1-problema-elegido)
2. [Justificación del Manejador](#2-justificación-del-manejador-de-base-de-datos)
3. [Guía de CouchDB](#3-guía-del-manejador-de-base-de-datos-couchdb)
4. [Modelo de Datos](#4-modelo-de-datos-diseñado)
5. [Configuración del Manejador](#5-configuración-del-manejador)
6. [Framework de Desarrollo](#6-elección-del-framework-de-desarrollo)
7. [Carga de Datos y Consultas](#7-carga-de-datos-y-consultas)
8. [Funcionalidades Implementadas](#8-funcionalidades-implementadas)
9. [Reportes Implementados](#9-reportes-implementados)
10. [Estructura del Proyecto](#10-estructura-del-proyecto)
11. [Actividades del Equipo](#11-cuadro-de-actividades)
12. [Conclusiones](#12-conclusiones)

---

## 1. Problema Elegido

### Películas o Series de Televisión

Se requiere un sistema que permita registrar las fechas de estreno y datos de películas o series de TV de un portal de contenidos por streaming.

### Entidades Requeridas

| Entidad | Campos |
|---------|--------|
| **Película** | Nombre, género(s), fecha de estreno, premios, número de descargas |
| **Serie** | Nombre, género(s), fecha de estreno, premios, número de descargas, número de temporadas, número de capítulos por temporada |
| **Actor/Actriz** | Nombre, País, Fecha de nacimiento, género (hombre/mujer) |
| **Archivo de Video** | URL del video, título |
| **Reparto** | Lista de actores/actrices |

### Reportes Requeridos

1. ✅ Películas o series estrenadas en un periodo de tiempo
2. ✅ Películas o series con mayor descarga
3. ✅ Películas o series por actor/actriz
4. ✅ Películas o series por género
5. ✅ Para un mismo actor/actriz, lista de actores/actrices con los que ha colaborado

---

## 2. Justificación del Manejador de Base de Datos

### ¿Por qué CouchDB (Almacén de Documentos)?

Se eligió **Apache CouchDB** por las siguientes razones técnicas:

#### 2.1 Flexibilidad del Esquema

```
El problema de películas/series tiene datos heterogéneos:
- Series tienen temporadas y episodios
- Películas no tienen temporadas
- Un manejador de documentos permite guardar ambos
  en la misma colección con esquemas diferentes
```

#### 2.2 Relaciones Flexibles

En CouchDB, las relaciones se manejan mediante **referencias por ID**:

```typescript
// Documento de Serie
{
  "_id": "title:breaking_bad",
  "mainCastId": "person:bryan_cranston",  // Referencia a actor
  "castIds": ["person:aaron_paul", "person:anna_gunn"]  // Array de referencias
}
```

#### 2.3 API RESTful Nativa

CouchDB expone una API HTTP que facilita la integración:

| Operación | Método HTTP | Endpoint |
|-----------|-------------|----------|
| Crear | `POST` | `/database` |
| Leer | `GET` | `/database/doc_id` |
| Actualizar | `PUT` | `/database/doc_id` |
| Eliminar | `DELETE` | `/database/doc_id?rev=xxx` |
| Consultar | `POST` | `/database/_find` |

#### 2.4 Consultas con Mango Query

CouchDB soporta consultas tipo JSON (Mango Query):

```json
{
  "selector": {
    "genres": { "$elemMatch": { "$eq": "Drama" } },
    "premiered": { "$gte": "2020-01-01" }
  }
}
```

#### 2.5 Comparación con Alternativas

| Característica | CouchDB | MongoDB | Redis |
|----------------|---------|---------|-------|
| Tipo | Documentos | Documentos | Clave-Valor |
| API REST | ✅ Nativa | ❌ Requiere driver | ❌ Requiere driver |
| Consultas JSON | ✅ Mango Query | ✅ Query Language | ❌ No aplica |
| Interfaz Web | ✅ Fauxton | ❌ Requiere Compass | ❌ No tiene |
| Offline First | ✅ PouchDB sync | ❌ No | ❌ No |
| CORS Built-in | ✅ Configurable | ❌ Requiere proxy | ❌ N/A |

---

## 3. Guía del Manejador de Base de Datos (CouchDB)

### 3.1 Características de CouchDB

| Característica | Descripción |
|----------------|-------------|
| **Modelo** | Almacén de documentos JSON |
| **Lenguaje** | Erlang |
| **Protocolo** | HTTP/REST |
| **Consultas** | Mango Query (JSON) y MapReduce |
| **Replicación** | Master-Master bidireccional |
| **Consistencia** | Eventual (MVCC) |
| **Control de versiones** | Usa `_rev` para cada documento |

### 3.2 Estructura de CouchDB

```
CouchDB Server (http://localhost:5984)
├── _all_dbs                    # Lista todas las bases de datos
├── series_db/                  # Base de datos para series
│   ├── _find                   # Endpoint para Mango Queries
│   ├── _design/views           # Vistas MapReduce
│   └── title:breaking_bad      # Documento individual
├── peliculas_db/               # Base de datos para películas
├── actores_db/                 # Base de datos para actores
├── descripcion_db/             # Sinopsis y descripciones
└── watchlist_db/               # Lista personal del usuario
```

### 3.3 Definición de Datos (DDL Equivalente)

En CouchDB no existe DDL tradicional. Los documentos se crean dinámicamente:

```bash
# Crear base de datos
curl -X PUT http://admin:password@localhost:5984/series_db

# Crear documento
curl -X POST http://admin:password@localhost:5984/series_db \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "title:the_boys",
    "type": "content",
    "contentType": "SERIE",
    "name": "The Boys",
    "genres": ["Action", "Sci-Fi"],
    "premiered": "2019-07-26"
  }'
```

### 3.4 Lenguaje de Consulta (Mango Query)

#### Consulta por Igualdad
```json
{
  "selector": {
    "contentType": "SERIE"
  }
}
```

#### Consulta por Rango
```json
{
  "selector": {
    "premiered": {
      "$gte": "2020-01-01",
      "$lte": "2025-12-31"
    }
  }
}
```

#### Consulta con Ordenamiento
```json
{
  "selector": {
    "type": "content"
  },
  "sort": [{ "downloads": "desc" }],
  "limit": 10
}
```

#### Consulta por Array
```json
{
  "selector": {
    "genres": {
      "$elemMatch": { "$eq": "Drama" }
    }
  }
}
```

### 3.5 Operaciones CRUD en TypeScript

```typescript
// couchdb.service.ts

// CREATE - Insertar documento
createIn<T>(db: TargetDatabase, doc: T): Observable<CouchResponse> {
  const url = `${this.baseUrl}/${this.dbMapping[db]}`;
  return this.http.post<CouchResponse>(url, doc, { headers });
}

// READ - Leer documentos con Mango Query
listByTypeIn<T>(db: TargetDatabase): Observable<{ docs: T[] }> {
  const url = `${this.baseUrl}/${this.dbMapping[db]}/_find`;
  return this.http.post<{ docs: T[] }>(url, { selector: {}, limit: 1000 }, { headers });
}

// UPDATE - Actualizar documento (requiere _rev)
updateIn<T extends CouchDoc>(db: TargetDatabase, doc: T): Observable<CouchResponse> {
  const url = `${this.baseUrl}/${this.dbMapping[db]}/${doc._id}`;
  return this.http.put<CouchResponse>(url, doc, { headers });
}

// DELETE - Eliminar documento (requiere _rev)
deleteIn(db: TargetDatabase, id: string, rev: string): Observable<CouchResponse> {
  const url = `${this.baseUrl}/${this.dbMapping[db]}/${id}?rev=${rev}`;
  return this.http.delete<CouchResponse>(url, { headers });
}
```

---

## 4. Modelo de Datos Diseñado

### 4.1 Diagrama de Documentos

```
┌─────────────────────────────────────────────────────────────────┐
│                    BASES DE DATOS COUCHDB                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │    series_db     │──────────────│   actores_db     │        │
│  │                  │  referencia  │                  │        │
│  │ _id: string      │  mainCastId  │ _id: string      │        │
│  │ type: "content"  │  castIds[]   │ type: "person"   │        │
│  │ contentType      │──────────────│ fullName         │        │
│  │ name             │              │ country          │        │
│  │ genres[]         │              │ birthDate        │        │
│  │ premiered        │              │ gender           │        │
│  │ awards[]         │              │ image?           │        │
│  │ downloads        │              │ bio?             │        │
│  │ rating           │              └──────────────────┘        │
│  │ mainCastId ──────┼─────────────────────▲                    │
│  │ castIds[] ───────┼─────────────────────┘                    │
│  │ seasons[]        │                                          │
│  │ video            │                                          │
│  │ image            │                                          │
│  └──────────────────┘                                          │
│           │                                                     │
│           │ _id                                                 │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ descripcion_db   │                                          │
│  │                  │                                          │
│  │ contentId        │                                          │
│  │ summaryEn        │                                          │
│  │ summaryEs        │                                          │
│  └──────────────────┘                                          │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐            │
│  │  peliculas_db    │         │   watchlist_db   │            │
│  │  (misma struct)  │         │   (localStorage) │            │
│  └──────────────────┘         └──────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Interfaces TypeScript

```typescript
// Content (Serie o Película)
interface Content {
  _id?: string;
  _rev?: string;
  type: 'content';
  contentType: 'MOVIE' | 'SERIE';
  name: string;
  genres: string[];
  premiered: string;
  awards: string[];
  downloads: number;
  rating: number | null;
  mainCastId: string;
  castIds: string[];
  seasons?: Season[];
  video?: { url: string };
  image?: string;
}

// Temporada (para Series)
interface Season {
  seasonNumber: number;
  episodeCount: number;
}

// Persona (Actor/Actriz)
interface Person {
  _id?: string;
  _rev?: string;
  type: 'person';
  fullName: string;
  country: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  image?: string;
  bio?: string;
}

// Descripción/Sinopsis
interface Description {
  _id?: string;
  _rev?: string;
  type: 'description';
  contentId: string;
  summaryEn: string;
  summaryEs: string;
}
```

### 4.3 Ejemplo de Documento Real

```json
{
  "_id": "title:breaking_bad",
  "_rev": "3-a7f32bc9e815d2f3c",
  "type": "content",
  "contentType": "SERIE",
  "name": "Breaking Bad",
  "genres": ["Drama", "Crime", "Thriller"],
  "premiered": "2008-01-20",
  "awards": ["Emmy", "Golden Globe", "Peabody"],
  "downloads": 1542,
  "rating": 9.5,
  "mainCastId": "person:bryan_cranston",
  "castIds": [
    "person:aaron_paul",
    "person:anna_gunn",
    "person:dean_norris"
  ],
  "seasons": [
    { "seasonNumber": 1, "episodeCount": 7 },
    { "seasonNumber": 2, "episodeCount": 13 },
    { "seasonNumber": 3, "episodeCount": 13 },
    { "seasonNumber": 4, "episodeCount": 13 },
    { "seasonNumber": 5, "episodeCount": 16 }
  ],
  "video": {
    "url": "https://www.youtube.com/watch?v=HhesaQXLuRY"
  },
  "image": "https://static.tvmaze.com/uploads/images/medium_portrait/0/2400.jpg"
}
```

---

## 5. Configuración del Manejador

### 5.1 Instalación de CouchDB

```bash
# Windows - Descargar instalador desde:
# https://couchdb.apache.org/#download

# Docker (alternativa)
docker run -d --name couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=admin \
  couchdb:3
```

### 5.2 Configuración CORS

Para permitir acceso desde el frontend Angular:

```bash
# Habilitar CORS vía API
curl -X PUT http://admin:admin@localhost:5984/_node/_local/_config/httpd/enable_cors \
  -d '"true"'

curl -X PUT http://admin:admin@localhost:5984/_node/_local/_config/cors/origins \
  -d '"*"'

curl -X PUT http://admin:admin@localhost:5984/_node/_local/_config/cors/methods \
  -d '"GET, PUT, POST, DELETE, OPTIONS"'

curl -X PUT http://admin:admin@localhost:5984/_node/_local/_config/cors/headers \
  -d '"accept, authorization, content-type, origin"'
```

### 5.3 Creación de Bases de Datos

```bash
# Crear las 5 bases de datos
curl -X PUT http://admin:admin@localhost:5984/series_db
curl -X PUT http://admin:admin@localhost:5984/peliculas_db
curl -X PUT http://admin:admin@localhost:5984/actores_db
curl -X PUT http://admin:admin@localhost:5984/descripcion_db
curl -X PUT http://admin:admin@localhost:5984/watchlist_db
```

### 5.4 Archivo de Configuración (environment.ts)

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  couchdb: {
    host: 'localhost',
    port: 5984,
    user: 'admin',
    password: 'admin'
  },
  geminiApiKey: 'YOUR_GEMINI_API_KEY'
};
```

---

## 6. Elección del Framework de Desarrollo

### 6.1 Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|------------|---------|---------------|
| **Frontend** | Angular | 19.x | Framework robusto con TypeScript nativo |
| **Lenguaje** | TypeScript | 5.x | Tipado estático, mejor mantenibilidad |
| **Estilos** | TailwindCSS | 3.x | Desarrollo rápido de UI moderna |
| **HTTP** | HttpClient | Angular | Integración nativa con RxJS |
| **Estado** | Signals | Angular 19 | Reactividad moderna sin Redux |
| **API IA** | Gemini | 2.5 Flash | Traducción y búsqueda inteligente |
| **Base de Datos** | CouchDB | 3.x | API REST nativa |

### 6.2 Arquitectura del Proyecto

```
src/
├── app/
│   ├── pages/
│   │   ├── search/         # Búsqueda de series (TvMaze API)
│   │   ├── watchlist/      # Lista personal con videos
│   │   ├── catalog/        # Catálogo de BD
│   │   ├── reports/        # Reportes + Edición
│   │   └── docs/           # Documentación técnica
│   └── app.routes.ts       # Rutas de la aplicación
├── services/
│   ├── couchdb.service.ts  # Operaciones CRUD CouchDB
│   ├── catalog.service.ts  # Lógica de negocio
│   ├── reports.service.ts  # Lógica de reportes
│   ├── tvmaze.service.ts   # API externa TvMaze
│   └── gemini.service.ts   # API Gemini para IA
├── models/
│   └── types.ts            # Interfaces TypeScript
└── environments/
    └── environment.ts      # Configuración
```

### 6.3 Servicios Principales

#### CouchDbService
```typescript
// Servicio de bajo nivel para operaciones HTTP con CouchDB
@Injectable({ providedIn: 'root' })
export class CouchDbService {
  private baseUrl: string;
  
  createIn<T>(db: TargetDatabase, doc: T): Observable<CouchResponse>;
  listByTypeIn<T>(db: TargetDatabase): Observable<{ docs: T[] }>;
  updateIn<T>(db: TargetDatabase, doc: T): Observable<CouchResponse>;
  deleteIn(db: TargetDatabase, id: string, rev: string): Observable<CouchResponse>;
}
```

#### CatalogService
```typescript
// Servicio de lógica de negocio
@Injectable({ providedIn: 'root' })
export class CatalogService {
  contents = signal<ContentPopulated[]>([]);
  persons = signal<Person[]>([]);
  
  refreshData(): void;
  saveFromTvMaze(show: TvMazeShow): Promise<SaveResult>;
  updateContent(data: EditableContent): Promise<boolean>;
  updatePersonImage(id: string, url: string): Promise<boolean>;
}
```

#### ReportsService
```typescript
// Servicio para reportes
@Injectable({ providedIn: 'root' })
export class ReportsService {
  getByDateRange(start: string, end: string): Observable<ContentPopulated[]>;
  getTopDownloads(): Observable<ContentPopulated[]>;
  getByActor(actorId: string): Observable<ContentPopulated[]>;
  getByGenre(genre: string): Observable<ContentPopulated[]>;
  getCollaborators(actorId: string): Observable<CollabResult[]>;
}
```

---

## 7. Carga de Datos y Consultas

### 7.1 Fuentes de Datos

| Fuente | Uso | Datos |
|--------|-----|-------|
| **TvMaze API** | Búsqueda inicial | Series, actores, temporadas |
| **Gemini API** | Traducción y IA | Descripciones en español |
| **Manual** | Edición | Campos personalizados |

### 7.2 Proceso de Importación

```typescript
// catalog.service.ts
async saveFromTvMaze(show: TvMazeShow): Promise<SaveResult> {
  // 1. Generar ID único
  const contentId = this.generateContentId(show.name);
  
  // 2. Obtener cast desde TvMaze
  const castInfo = await firstValueFrom(this.tvmaze.getCast(show.id));
  
  // 3. Guardar actores en actores_db
  for (const member of castInfo.cast) {
    const personId = this.generatePersonId(member.person.name);
    await this.savePerson(personId, member.person);
  }
  
  // 4. Guardar contenido en series_db
  const content: Content = {
    _id: contentId,
    type: 'content',
    contentType: 'SERIE',
    name: show.name,
    genres: show.genres,
    premiered: show.premiered,
    mainCastId: mainActorId,
    castIds: castIds,
    seasons: seasons
  };
  
  await firstValueFrom(this.db.createIn('series', content));
  
  // 5. Traducir descripción con Gemini
  const summaryEs = await this.gemini.translateToSpanish(show.summary);
  await this.saveDescription(contentId, show.summary, summaryEs);
  
  return { success: true };
}
```

### 7.3 Consultas de Reportes

#### Reporte 1: Por Período de Fechas
```typescript
getByDateRange(start: string, end: string): Observable<ContentPopulated[]> {
  const allContent = this.catalogService.contents();
  return of(allContent.filter(c => 
    c.premiered >= start && c.premiered <= end
  ));
}
```

#### Reporte 2: Top Descargas
```typescript
getTopDownloads(): Observable<ContentPopulated[]> {
  const allContent = this.catalogService.contents();
  return of(
    [...allContent]
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10)
  );
}
```

#### Reporte 3: Por Actor
```typescript
getByActor(actorId: string): Observable<ContentPopulated[]> {
  const allContent = this.catalogService.contents();
  return of(allContent.filter(c => 
    c.mainCastId === actorId || c.castIds.includes(actorId)
  ));
}
```

#### Reporte 4: Por Género
```typescript
getByGenre(genre: string): Observable<ContentPopulated[]> {
  const allContent = this.catalogService.contents();
  const searchGenre = genre.toLowerCase();
  return of(allContent.filter(c =>
    c.genres.some(g => g.toLowerCase().includes(searchGenre))
  ));
}
```

#### Reporte 5: Colaboraciones
```typescript
getCollaborators(actorId: string): Observable<CollabResult[]> {
  // 1. Encontrar contenidos donde participa el actor
  const contents = this.catalogService.contents();
  const actorContents = contents.filter(c =>
    c.mainCastId === actorId || c.castIds.includes(actorId)
  );
  
  // 2. Contar colaboradores
  const collabMap = new Map<string, number>();
  for (const content of actorContents) {
    const allActors = [content.mainCastId, ...content.castIds];
    for (const otherId of allActors) {
      if (otherId !== actorId) {
        collabMap.set(otherId, (collabMap.get(otherId) || 0) + 1);
      }
    }
  }
  
  // 3. Resolver nombres
  return of(
    Array.from(collabMap.entries()).map(([id, count]) => ({
      name: persons.find(p => p._id === id)?.fullName || id,
      count
    }))
  );
}
```

---

## 8. Funcionalidades Implementadas

### 8.1 Módulo de Búsqueda

| Funcionalidad | Descripción |
|---------------|-------------|
| Búsqueda en TvMaze | Consulta API externa para encontrar series |
| Importación automática | Guarda serie + actores + temporadas en CouchDB |
| Traducción IA | Traduce sinopsis al español con Gemini |
| Vista previa | Muestra poster, rating y géneros |

### 8.2 Módulo de Watchlist

| Funcionalidad | Descripción |
|---------------|-------------|
| Agregar a lista | Botón para guardar series favoritas |
| Múltiples videos | Cada serie puede tener varios links de video |
| Calificación personal | Rating de 1-5 estrellas por el usuario |
| Reseña personal | Textarea para comentarios |
| Contador de vistas | Incrementa al reproducir video |

### 8.3 Módulo de Catálogo

| Funcionalidad | Descripción |
|---------------|-------------|
| Lista completa | Muestra todos los contenidos de CouchDB |
| Filtrado | Por tipo (serie/película) |
| Detalles | Modal con información completa |

### 8.4 Módulo de Reportes

| Funcionalidad | Descripción |
|---------------|-------------|
| 5 tipos de reportes | Fechas, Descargas, Actor, Género, Colaboraciones |
| Interactividad | Click en resultado abre modal |
| Biografías IA | Genera bio de actor con Gemini |
| Edición completa | Pestaña para modificar cualquier campo |

### 8.5 Módulo de Documentación

| Funcionalidad | Descripción |
|---------------|-------------|
| 6 secciones | Estructura, CREATE, READ, UPDATE, DELETE, Relaciones |
| Ejemplos de código | TypeScript y HTTP |
| Diagrama visual | Relaciones entre bases de datos |

---

## 9. Reportes Implementados

### Reporte 1: Películas/Series por Período

**Descripción:** Filtra contenido por rango de fechas de estreno.

**Entrada:** Fecha inicio y fecha fin (formato YYYY-MM-DD)

**Consulta equivalente:**
```json
{
  "selector": {
    "premiered": {
      "$gte": "2020-01-01",
      "$lte": "2025-12-31"
    }
  }
}
```

---

### Reporte 2: Top Descargas

**Descripción:** Muestra los 10 contenidos más descargados.

**Ordenamiento:** Descendente por campo `downloads`

**Consulta equivalente:**
```json
{
  "selector": { "type": "content" },
  "sort": [{ "downloads": "desc" }],
  "limit": 10
}
```

---

### Reporte 3: Por Actor/Actriz

**Descripción:** Filtra contenido donde participa un actor específico.

**Lógica:** Busca en `mainCastId` y `castIds[]`

**Consulta equivalente:**
```json
{
  "selector": {
    "$or": [
      { "mainCastId": "person:bryan_cranston" },
      { "castIds": { "$elemMatch": { "$eq": "person:bryan_cranston" } } }
    ]
  }
}
```

---

### Reporte 4: Por Género

**Descripción:** Filtra contenido que contenga un género específico.

**Lógica:** Búsqueda parcial insensible a mayúsculas en `genres[]`

**Consulta equivalente:**
```json
{
  "selector": {
    "genres": {
      "$elemMatch": { "$regex": "(?i)drama" }
    }
  }
}
```

---

### Reporte 5: Colaboraciones

**Descripción:** Para un actor, lista otros actores con los que ha trabajado.

**Lógica:**
1. Encontrar todos los contenidos del actor
2. Extraer todos los `castIds` de esos contenidos
3. Contar ocurrencias de cada actor colaborador
4. Ordenar por número de colaboraciones

**Implementación MapReduce conceptual:**
```javascript
// Map
function(doc) {
  if (doc.type === 'content') {
    var allActors = [doc.mainCastId].concat(doc.castIds);
    for (var i = 0; i < allActors.length; i++) {
      for (var j = i+1; j < allActors.length; j++) {
        emit([allActors[i], allActors[j]], 1);
      }
    }
  }
}

// Reduce
function(keys, values) {
  return sum(values);
}
```

---

## 10. Estructura del Proyecto

```
PROYECTODB/
├── ProyectoDB/
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/
│   │   │   │   ├── search/               # Búsqueda TvMaze
│   │   │   │   │   ├── search.component.ts
│   │   │   │   │   ├── search.component.html
│   │   │   │   │   └── search.component.css
│   │   │   │   ├── watchlist/            # Lista personal
│   │   │   │   │   ├── watchlist.component.ts
│   │   │   │   │   ├── watchlist.component.html
│   │   │   │   │   └── watchlist.component.css
│   │   │   │   ├── catalog/              # Catálogo
│   │   │   │   ├── reports/              # Reportes + Edición
│   │   │   │   ├── docs/                 # Documentación
│   │   │   │   └── settings/             # Configuración
│   │   │   └── app.routes.ts
│   │   ├── services/
│   │   │   ├── couchdb.service.ts        # CRUD CouchDB
│   │   │   ├── catalog.service.ts        # Lógica negocio
│   │   │   ├── reports.service.ts        # Reportes
│   │   │   ├── watchlist.service.ts      # Watchlist
│   │   │   ├── tvmaze.service.ts         # API TvMaze
│   │   │   └── gemini.service.ts         # API Gemini
│   │   ├── models/
│   │   │   └── types.ts                  # Interfaces
│   │   └── environments/
│   │       └── environment.ts            # Config
│   ├── package.json
│   ├── angular.json
│   └── README.md                         # Este archivo
└── scripts/
    └── migrate_databases.js              # Script migración
```

---

## 11. Cuadro de Actividades

| Miembro | Actividad | Tiempo |
|---------|-----------|--------|
| Josué Sáenz | Diseño modelo de datos y estructura CouchDB | 4h |
| Kevin Mendez | Configuración CouchDB y CORS | 2h |
| Josué Sáenz | Desarrollo servicios CouchDB y Catalog | 6h |
| Edwin Angamarca | Integración API TvMaze | 3h |
| Josué Sáenz | Desarrollo módulo de búsqueda | 4h |
| Edwin Angamarca | Desarrollo módulo watchlist | 5h |
| Christian Naula | Desarrollo módulo de reportes | 6h |
| Kevin Mendez | Documentación y pruebas | 4h |
| **Todos** | Integración y pruebas finales | 4h |
| | **TOTAL** | **38h** |

---

## 12. Conclusiones

### 12.1 Sobre CouchDB

- CouchDB demostró ser una excelente opción para datos heterogéneos como películas y series que tienen estructuras ligeramente diferentes.
- La API REST nativa facilitó enormemente la integración con Angular sin necesidad de drivers adicionales.
- El sistema de revisiones (`_rev`) previene conflictos pero requiere atención al actualizar documentos.
- Las consultas Mango Query son intuitivas y suficientes para reportes básicos y filtrados.

### 12.2 Sobre el Desarrollo

- Angular 19 con Signals proporcionó una arquitectura reactiva limpia sin necesidad de librerías de estado externas.
- La integración con APIs externas (TvMaze, Gemini) enriqueció significativamente la funcionalidad.
- La separación en servicios especializados (CouchDB, Catalog, Reports) mejoró la mantenibilidad.

### 12.3 Cumplimiento de Requisitos

| Requisito | Estado |
|-----------|--------|
| Modelo de datos implementado | ✅ 100% |
| 5 Reportes funcionales | ✅ 100% |
| Operaciones CRUD | ✅ 100% |
| Interfaz gráfica | ✅ 100% |
| Documentación | ✅ 100% |

### 12.4 Lecciones Aprendidas

1. Los almacenes de documentos son ideales cuando los datos tienen esquemas variables.
2. Las relaciones en NoSQL se manejan con referencias (IDs) y requieren "poblar" manualmente.
3. CORS debe configurarse antes de comenzar el desarrollo frontend.
4. El control de versiones (`_rev`) es crítico para operaciones de actualización.

---

## Referencias Bibliográficas

1. Apache CouchDB Documentation. (2024). *CouchDB: The Definitive Guide*. https://docs.couchdb.org/
2. Angular Team. (2024). *Angular Developer Guide*. https://angular.dev/
3. TvMaze API. (2024). *TvMaze API Documentation*. https://www.tvmaze.com/api
4. Google. (2024). *Gemini API Documentation*. https://ai.google.dev/

---

## Comandos para Ejecutar el Proyecto

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Acceder a la aplicación
# http://localhost:3000

# Acceder a CouchDB Fauxton
# http://localhost:5984/_utils
```

---

**Proyecto desarrollado para la materia de Gestión de Bases de Datos - 2026**
