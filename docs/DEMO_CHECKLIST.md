# Demo Checklist - MegaBuscador TV

Guía rápida para demostrar la aplicación ante el evaluador.

---

## Requisitos Previos

1. **Docker Desktop** instalado y corriendo
2. **Node.js** v18+ instalado
3. **Puerto 5984** disponible (CouchDB)

---

## Pasos de Ejecución

### 1. Levantar CouchDB
```bash
cd c:\Users\josue\Desktop\PROYECTODB\ProyectoDB
docker-compose up -d
```
Esperar ~10 segundos hasta que CouchDB esté listo.

### 2. Configurar BD y Cargar Datos
```bash
npm run seed
```
Esto crea:
- Base de datos `peliculas_db`
- 7 índices Mango
- Design doc `_design/reports` (5 vistas)
- 12 personas + 8 contenidos de prueba

### 3. Iniciar la Aplicación
```bash
npm run dev
```
Abrir: http://localhost:4200

---

## Demostración de los 5 Reportes Obligatorios

### Reporte 1: Estrenadas en un Período
1. Ir a **Reportes** (menú lateral)
2. Tab **"Fechas"** está seleccionado por defecto
3. Ingresar:
   - Fecha inicio: `2008-01-01`
   - Fecha fin: `2015-12-31`
4. Click **"Ejecutar Consulta"**
5. Verificar: aparecen contenidos estrenados en ese rango

### Reporte 2: Mayor Descarga (Top N)
1. Click en tab **"Top Descargas"**
2. Se carga automáticamente el top 10
3. Verificar: ordenados de mayor a menor descargas
4. Nota: "Game of Thrones" debería estar primero (200,000)

### Reporte 3: Por Actor/Actriz
1. Click en tab **"Por Actor"**
2. Seleccionar **"Leonardo DiCaprio"** del dropdown
3. Verificar: muestra Inception, Titanic, Revolutionary Road

### Reporte 4: Por Género
1. Click en tab **"Por Género"**
2. Escribir: `Drama`
3. Click **"Buscar"**
4. Verificar: múltiples resultados con género Drama

### Reporte 5: Colaboraciones
1. Click en tab **"Colaboraciones"**
2. Seleccionar **"Leonardo DiCaprio"** del dropdown
3. Verificar: aparece lista de actores con conteo de proyectos juntos
   - Kate Winslet: 2 proyectos (Titanic, Revolutionary Road)

---

## Otras Demostraciones

### Crear Película Manual
1. Ir a **Catálogo**
2. Click **"Nuevo Contenido"**
3. Llenar:
   - Tipo: Película
   - Nombre: "Dune"
   - Fecha: 2021-10-22
   - Géneros: Ciencia Ficción, Aventura
   - Premios: Oscar Mejor Fotografía, Oscar Mejor Sonido
   - Seleccionar actor principal
4. Click **"Guardar en CouchDB"**
5. Verificar en lista del catálogo

### Simular Descarga
1. En **Catálogo**, hover sobre cualquier tarjeta
2. Click botón **"+1 Descarga"**
3. Ver cómo incrementa el contador
4. Recargar página (F5) y verificar persistencia

### Importar Serie desde TVMaze
1. Ir a **Buscar**
2. Buscar: "The Office"
3. Click en resultado para ver detalles
4. Se importa automáticamente con:
   - Imagen y rating
   - Video de YouTube (si disponible)
   - Cast real desde TVMaze
5. Ir a **Catálogo** y verificar

---

## Verificación en Fauxton

Abrir: http://localhost:5984/_utils

1. **Documentos**: Base datos → `peliculas_db` → todos los docs
2. **Índices**: Base datos → Design Documents → `_design/reports`
3. **Vistas**: Ejecutar vista `by_downloads` con `descending=true`

---

## Puntos Clave para la Rúbrica

| Criterio | Evidencia |
|----------|-----------|
| Modelo implementado (30%) | awards es array, downloads actualizable, cast real |
| Reportes (30%) | Los 5 funcionan con datos reales desde CouchDB |
| Guía 5 páginas | Ver `docs/GUIA_COUCHDB.md` |
| Framework | Angular 21 + CouchDB REST API directa |
