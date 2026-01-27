# Informe de Proyecto: Streaming Guide con CouchDB

**Integrantes:** [Tu Nombre]

## 1. Problema Elegido
Se ha desarrollado un "Portal de Streaming" para gestionar un catálogo de Películas y Series.
El sistema debe permitir:
*   Gestionar metadatos (título, estreno, género, premios).
*   Diferenciar entre Películas (entidad simple) y Series (con temporadas).
*   Gestionar Actores y relacionarlos con los contenidos (Reparto).
*   Analizar datos: Top descargas, estrenos por fecha, colaboraciones.

**Justificación Técnica (NoSQL):**
Se eligió **Apache CouchDB** por su flexibilidad de esquema (Schema-less).
*   **Variabilidad:** Las Series tienen estructura anidada (`seasons`) que las películas no tienen. Un modelo relacional requeriría tablas adicionales o nulos; CouchDB lo maneja natural en JSON.
*   **Documental:** La información de una película se consulta generalmente como un "todo". El modelo documental optimiza la lectura.
*   **HTTP Nativo:** Permite conectar la SPA (Angular) directamente a la BD sin middleware backend, simplificando la arquitectura prototipo.

## 2. Guía del Manejador
(Ver archivo adjunto `GUIA_COUCHDB.md`)

## 3. Modelo de Datos Diseñado

Diagrama conceptual (JSON):

**Entidad: Persona (`type: 'person'`)**
```json
{
  "_id": "person_brad_pitt",
  "type": "person",
  "fullName": "Brad Pitt",
  "birthDate": "1963-12-18",
  "gender": "HOMBRE"
}
```

**Entidad: Contenido (`type: 'content'`)**
```json
{
  "_id": "content_fight_club",
  "type": "content",
  "contentType": "MOVIE",
  "name": "Fight Club",
  "genres": ["Drama"],
  "downloads": 50000,
  "castIds": ["person_brad_pitt", "person_edward_norton"],
  "seasons": [] // Opcional, solo si es Serie
}
```

## 4. Configuración Realizada

Se utilizó **Docker Compose** para orquestar el servicio.
*   Imagen: `apache/couchdb:3`
*   Puerto: `5984` expuesto al host.
*   Persistencia: Volumen `./couchdb_data`.

**Script de Setup (`setup_couchdb.sh`):**
Automatiza la creación de la infraestructura lógica:
1.  Habilita **CORS** para permitir peticiones desde `localhost:4200` (Angular).
2.  Crea la BD `streaming_db`.
3.  Sube el `_design/streaming` con las Vistas MapReduce.
4.  Crea índices Mango para búsquedas por fecha.
5.  Carga datos semilla (`seed.json`).

## 5. Framework: Angular

Se eligió Angular por:
*   **Robustez:** Tipado fuerte (TypeScript) ideal para mapear documentos NoSQL a interfaces.
*   **HttpClient:** Integración nativa fluida con la API REST de CouchDB.
*   **Standalone Components:** Arquitectura moderna y ligera.

## 6. Carga de Datos y Consultas
Se cargaron 15 documentos iniciales (10 personas, 5 contenidos) mediante Bulk API.

**Ejemplo Consulta (Mango):**
"Buscar contenidos de Drama estrenados después de 2000"
```json
{
  "selector": {
    "type": "content",
    "genres": { "$elemMatch": { "$eq": "Drama" } },
    "premiered": { "$gte": "2000" }
  }
}
```

**Ejemplo Vista (MapReduce):**
"Contar colaboraciones entre actores"
Map: Emite pares `[ActorA, ActorB]`.
Reduce: `_sum`.
Resultado: `{"key": ["person_a", "person_b"], "value": 1}`.

## 7. Tabla de Actividades

| Integrante | Actividad | Horas |
| :--- | :--- | :--- |
| [Nombre] | Diseño del Modelo JSON | 2 |
| [Nombre] | Configuración Docker y Scripts | 3 |
| [Nombre] | Desarrollo Servicios Angular (CouchDB) | 4 |
| [Nombre] | Implementación Reportes (Vistas) | 4 |
| [Nombre] | Pruebas y Documentación | 3 |

## 8. Conclusiones
La integración directa Angular-CouchDB es sumamente ágil para prototipado rápido. Las Vistas MapReduce ofrecen una potencia analítica que compensa la falta de Joins en NoSQL, permitiendo resolver reportes complejos (como redes de actores) directamente en el motor de base de datos.
