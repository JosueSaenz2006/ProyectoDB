import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CodeExample {
    title: string;
    description: string;
    code: string;
    language: string;
}

interface DocSection {
    id: string;
    title: string;
    description: string;
    examples: CodeExample[];
}

@Component({
    selector: 'app-docs',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './docs.component.html',
    styleUrl: './docs.component.css'
})
export class DocsComponent {
    activeSection = 'structure';

    sections: DocSection[] = [
        {
            id: 'structure',
            title: '1. Estructura de Bases de Datos',
            description: 'CouchDB almacena documentos JSON en bases de datos separadas. Este proyecto utiliza múltiples bases de datos para organizar la información.',
            examples: [
                {
                    title: 'Bases de Datos Utilizadas',
                    description: 'Cada tipo de documento se almacena en su propia base de datos:',
                    language: 'typescript',
                    code: `// Configuración de bases de datos en couchdb.service.ts
export type TargetDatabase = 'series' | 'peliculas' | 'actores' | 'descripcion' | 'watchlist';

private readonly dbMapping: Record<TargetDatabase, string> = {
  series: 'series_db',       // Series de TV
  peliculas: 'peliculas_db', // Películas
  actores: 'actores_db',     // Actores/Personas
  descripcion: 'descripcion_db', // Sinopsis
  watchlist: 'watchlist_db'  // Lista personal
};`
                },
                {
                    title: 'Estructura de Documento (Content)',
                    description: 'Ejemplo de cómo se estructura un documento de serie/película:',
                    language: 'typescript',
                    code: `// Modelo en types.ts
export interface Content extends CouchDoc {
  type: 'content';
  contentType: 'MOVIE' | 'SERIE';
  name: string;
  genres: string[];
  premiered: string;  // YYYY-MM-DD
  awards: string[];
  downloads: number;
  rating: number | null;
  mainCastId: string;  // Referencia a actor principal
  castIds: string[];   // Referencias a reparto
  seasons?: Season[];
  video?: { url: string };
  image?: string;
}

// Documento guardado en CouchDB:
{
  "_id": "title:breaking_bad",
  "_rev": "1-abc123...",
  "type": "content",
  "contentType": "SERIE",
  "name": "Breaking Bad",
  "genres": ["Drama", "Crime"],
  "premiered": "2008-01-20",
  "rating": 9.5,
  "downloads": 150,
  "mainCastId": "person:bryan_cranston",
  "castIds": ["person:aaron_paul", "person:anna_gunn"]
}`
                }
            ]
        },
        {
            id: 'create',
            title: '2. Crear Documentos (INSERT)',
            description: 'Para insertar nuevos documentos en CouchDB, usamos el método HTTP POST o PUT.',
            examples: [
                {
                    title: 'Servicio HTTP para Crear',
                    description: 'El método createIn() del CouchDbService:',
                    language: 'typescript',
                    code: `// couchdb.service.ts
createIn<T extends CouchDoc>(db: TargetDatabase, doc: T): Observable<CouchResponse> {
  const url = \`\${this.baseUrl}/\${this.dbMapping[db]}\`;
  
  return this.http.post<CouchResponse>(url, doc, {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(\`\${user}:\${pass}\`)
    })
  });
}

// Uso en catalog.service.ts:
async saveNewContent(content: Content): Promise<void> {
  const targetDb = content.contentType === 'SERIE' ? 'series' : 'peliculas';
  
  await firstValueFrom(
    this.db.createIn(targetDb, content)
  );
}`
                },
                {
                    title: 'Petición HTTP Real',
                    description: 'Esto es lo que se envía a CouchDB:',
                    language: 'http',
                    code: `POST http://localhost:5984/series_db HTTP/1.1
Content-Type: application/json
Authorization: Basic YWRtaW46cGFzc3dvcmQ=

{
  "_id": "title:the_boys",
  "type": "content",
  "contentType": "SERIE",
  "name": "The Boys",
  "genres": ["Action", "Sci-Fi"],
  "premiered": "2019-07-26",
  "downloads": 0,
  "rating": 8.7,
  "mainCastId": "person:karl_urban",
  "castIds": []
}

// Respuesta de CouchDB:
{
  "ok": true,
  "id": "title:the_boys",
  "rev": "1-967a00dff5e02add41819138abb3284d"
}`
                }
            ]
        },
        {
            id: 'read',
            title: '3. Leer Documentos (SELECT)',
            description: 'Para leer documentos usamos Mango Queries (consultas JSON) o el endpoint directo por ID.',
            examples: [
                {
                    title: 'Consulta Mango Query',
                    description: 'Listamos todos los documentos de un tipo:',
                    language: 'typescript',
                    code: `// couchdb.service.ts - Usando _find endpoint
listByTypeIn<T>(db: TargetDatabase): Observable<{ docs: T[] }> {
  const url = \`\${this.baseUrl}/\${this.dbMapping[db]}/_find\`;
  
  const query = {
    selector: {},  // Todos los documentos
    limit: 1000
  };
  
  return this.http.post<{ docs: T[] }>(url, query, { headers });
}

// Consulta con filtros (Por género):
const query = {
  selector: {
    genres: { "$elemMatch": { "$eq": "Drama" } }
  }
};`
                },
                {
                    title: 'Consulta por Rango de Fechas',
                    description: 'Ejemplo del reporte por fechas:',
                    language: 'typescript',
                    code: `// reports.service.ts
getByDateRange(start: string, end: string): Observable<ContentPopulated[]> {
  // Obtener todos los contenidos del CatalogService
  const allContent = this.catalogService.contents();
  
  // Filtrar por fecha de estreno
  const filtered = allContent.filter(c => {
    const premiered = c.premiered;
    return premiered >= start && premiered <= end;
  });
  
  return of(filtered);
}

// Consulta Mango equivalente:
{
  "selector": {
    "premiered": {
      "$gte": "2020-01-01",
      "$lte": "2025-12-31"
    }
  }
}`
                }
            ]
        },
        {
            id: 'update',
            title: '4. Actualizar Documentos (UPDATE)',
            description: 'CouchDB requiere el _rev actual para actualizar. Esto previene conflictos de escritura.',
            examples: [
                {
                    title: 'Método de Actualización',
                    description: 'El updateIn() envía el documento completo con _rev:',
                    language: 'typescript',
                    code: `// couchdb.service.ts
updateIn<T extends CouchDoc>(db: TargetDatabase, doc: T): Observable<CouchResponse> {
  // IMPORTANTE: Incluir _id y _rev del documento existente
  const url = \`\${this.baseUrl}/\${this.dbMapping[db]}/\${doc._id}\`;
  
  return this.http.put<CouchResponse>(url, doc, { headers });
}

// Uso en catalog.service.ts:
async updateContent(data: EditableContent): Promise<boolean> {
  // 1. Buscar documento existente para obtener _rev
  const existing = this.contents().find(c => c._id === data._id);
  
  // 2. Construir documento actualizado con mismo _id y _rev
  const updated: Content = {
    _id: existing._id,
    _rev: existing._rev,  // ¡Obligatorio para actualizar!
    type: 'content',
    ...data
  };
  
  // 3. Enviar a CouchDB
  await firstValueFrom(this.db.updateIn(targetDb, updated));
  return true;
}`
                },
                {
                    title: 'Petición HTTP de Actualización',
                    description: 'PUT al documento específico:',
                    language: 'http',
                    code: `PUT http://localhost:5984/series_db/title:the_boys HTTP/1.1
Content-Type: application/json
Authorization: Basic YWRtaW46cGFzc3dvcmQ=

{
  "_id": "title:the_boys",
  "_rev": "1-967a00dff5e02add41819138abb3284d",
  "type": "content",
  "name": "The Boys",
  "downloads": 50,  // Campo actualizado
  "rating": 9.0     // Campo actualizado
}

// Respuesta:
{
  "ok": true,
  "id": "title:the_boys",
  "rev": "2-new_revision_hash"  // Nuevo _rev
}`
                }
            ]
        },
        {
            id: 'delete',
            title: '5. Eliminar Documentos (DELETE)',
            description: 'Para eliminar se usa HTTP DELETE con el _rev actual.',
            examples: [
                {
                    title: 'Método de Eliminación',
                    description: 'El deleteIn() requiere ID y revisión:',
                    language: 'typescript',
                    code: `// couchdb.service.ts
deleteIn(db: TargetDatabase, id: string, rev: string): Observable<CouchResponse> {
  const url = \`\${this.baseUrl}/\${this.dbMapping[db]}/\${id}?rev=\${rev}\`;
  
  return this.http.delete<CouchResponse>(url, { headers });
}

// Uso:
async deleteContent(contentId: string): Promise<boolean> {
  const content = this.contents().find(c => c._id === contentId);
  
  if (!content?._rev) return false;
  
  const db = content.contentType === 'SERIE' ? 'series' : 'peliculas';
  await firstValueFrom(
    this.db.deleteIn(db, content._id, content._rev)
  );
  
  return true;
}`
                },
                {
                    title: 'Petición HTTP DELETE',
                    description: 'Eliminación con parámetro rev:',
                    language: 'http',
                    code: `DELETE http://localhost:5984/series_db/title:old_show?rev=3-abc123 HTTP/1.1
Authorization: Basic YWRtaW46cGFzc3dvcmQ=

// Respuesta exitosa:
{
  "ok": true,
  "id": "title:old_show",
  "rev": "4-deleted_revision"
}

// CouchDB no elimina físicamente, marca como _deleted: true`
                }
            ]
        },
        {
            id: 'relations',
            title: '6. Relaciones entre Documentos',
            description: 'CouchDB no tiene JOINs, pero podemos relacionar documentos usando IDs de referencia.',
            examples: [
                {
                    title: 'Referencia a Otros Documentos',
                    description: 'Un Content referencia a Person mediante IDs:',
                    language: 'typescript',
                    code: `// En Content guardamos IDs de Person
interface Content {
  mainCastId: string;  // "person:bryan_cranston"
  castIds: string[];   // ["person:aaron_paul", ...]
}

// Para "popular" estas referencias:
populateContent(content: Content): ContentPopulated {
  // Buscar personas por ID en la caché local
  const actorPrincipal = this.persons().find(
    p => p._id === content.mainCastId
  );
  
  const reparto = content.castIds.map(id => 
    this.persons().find(p => p._id === id)
  ).filter(p => !!p);
  
  return {
    ...content,
    actorPrincipal,
    reparto
  };
}`
                },
                {
                    title: 'Diagrama de Relaciones',
                    description: 'Estructura de referencias entre bases de datos:',
                    language: 'text',
                    code: `┌─────────────────────────────────────────────────────────┐
│                    COUCHDB DATABASES                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐     referencia      ┌─────────────┐  │
│  │  series_db   │ ───────────────────▶│ actores_db  │  │
│  │              │     mainCastId      │             │  │
│  │ _id          │     castIds[]       │ _id         │  │
│  │ name         │                     │ fullName    │  │
│  │ genres[]     │                     │ country     │  │
│  │ mainCastId ──┼─────────────────────│ birthDate   │  │
│  │ castIds[] ───┼─────────────────────│ gender      │  │
│  │ rating       │                     │ image       │  │
│  └──────────────┘                     └─────────────┘  │
│         │                                    ▲         │
│         │ _id (title:xxx)                    │         │
│         ▼                                    │         │
│  ┌──────────────┐                            │         │
│  │descripcion_db│     Misma estructura       │         │
│  │              │     para peliculas_db      │         │
│  │ contentId    │                            │         │
│  │ summaryEn    │                            │         │
│  │ summaryEs    │                            │         │
│  └──────────────┘                            │         │
│                                              │         │
│  ┌──────────────┐                            │         │
│  │ watchlist_db │  (localStorage, no CouchDB)│         │
│  │ serie_id     │                            │         │
│  │ videoId      │                            │         │
│  │ rating       │                            │         │
│  └──────────────┘                            │         │
└─────────────────────────────────────────────────────────┘`
                }
            ]
        }
    ];

    setSection(id: string): void {
        this.activeSection = id;
    }
}
