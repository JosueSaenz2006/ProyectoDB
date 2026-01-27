# Guía Técnica: Apache CouchDB

## 1. Introducción y Características
Apache CouchDB es una base de datos NoSQL orientada a documentos que almacena datos como JSON.

### Características Clave
*   **Document Store:** Almacena objetos JSON autocontenidos. No hay esquema rígido.
*   **API HTTP RESTful:** Todas las operaciones (CRUD, Configuración) se realizan mediante peticiones HTTP (GET, PUT, POST, DELETE).
*   **Protocolo de Replicación:** Su característica estrella. Permite sincronización bidireccional robusta (Offline-first).
*   **Control de Concurrencia (MVCC):** Utiliza `_rev` (revisiones) para manejar conflictos de edición.
*   **Vistas MapReduce:** Sistema potente de indexación y agregación escrito en JavaScript.
*   **Mango Queries:** Lenguaje de consulta declarativo similar a MongoDB (JSON selectors).

---

## 2. Estructura de Datos

### Base de Datos y Documentos
Una instancia de CouchDB contiene varias Bases de Datos. Cada DB contiene Documentos.
Un documento tiene campos especiales:
*   `_id`: Identificador único (String). Si no se provee, CouchDB genera un UUID.
*   `_rev`: Token de revisión (ej: `1-abc...`). Cambia con cada actualización.
*   `_attachments`: Archivos binarios adjuntos (imágenes, PDFs).

### Design Documents (`_design/*`)
Son documentos especiales que contienen código de aplicación, principalmente definiciones de **Vistas** e **Índices**.

---

## 3. Definición y Manipulación de Datos

### Crear Base de Datos
```bash
curl -X PUT http://admin:password@localhost:5984/mi_base_datos
```

### Insertar Documento
```bash
curl -X POST http://admin:password@localhost:5984/mi_base_datos \
     -H "Content-Type: application/json" \
     -d '{"nombre": "Matrix", "anio": 1999, "type": "movie"}'
```

### Bulk Docs (Inserción Masiva)
Ideal para seeds o cargas iniciales.
```json
POST /_bulk_docs
{
  "docs": [
    {"_id": "doc1", "val": 1},
    {"_id": "doc2", "val": 2}
  ]
}
```

---

## 4. Lenguaje de Consulta

### A. Mango Queries (Selectores)
Fáciles de usar, declarativos. Requieren índices para ser eficientes (`_index`).

**Crear Índice:**
```json
POST /_index
{
  "index": { "fields": ["anio"] },
  "name": "idx_anio"
}
```

**Consultar:**
```json
POST /_find
{
  "selector": {
    "anio": { "$gt": 2000 },
    "type": "movie"
  },
  "sort": [{"anio": "asc"}]
}
```

### B. MapReduce Views
Más potentes para agregaciones. Se definen en Javascript.

**Función Map:**
Emite pares Clave/Valor.
```javascript
function(doc) {
  if (doc.type === 'movie') {
    emit(doc.anio, doc.nombre);
  }
}
```

**Función Reduce:**
Agrega los valores emitidos (ej: `_sum`, `_count`, `_stats`).

**Consultar Vista:**
`GET /db/_design/doc/_view/vista?key=1999`

---

## 5. Arquitectura del Proyecto (Streaming Guide)

Para este proyecto, usamos un modelo de "Discriminador por Tipo":
*   Todos los docs van en `streaming_db`.
*   Campo `type`: `'content'` (Películas/Series) o `'person'` (Actores).
*   Relaciones: Los contenidos guardan arrays de IDs de actores (`castIds`). Las relaciones se resuelven en el cliente (Angular) o mediante Vistas complejas.

