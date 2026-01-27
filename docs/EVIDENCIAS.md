# Evidencias de Funcionamiento

## 1. Setup
- [x] Contenedor Docker `streaming_couchdb` corriendo (`docker ps`).
- [x] Acceso a Fauxton en `http://localhost:5984/_utils`.
- [x] Script `setup_couchdb.sh` ejecutado exitosamente (DB creada, Seed cargado).

## 2. Funcionalidad App
- [x] **Catálogo:** Muestra lista de películas/series traídas de CouchDB.
- [x] **Creación:** Formulario "Nuevo Contenido" guarda correctamente en CouchDB (persiste al recargar).
- [x] **Importación:** Buscador TVMaze permite enviar series al catálogo CouchDB.

## 3. Reportes (Rúbrica)
- [x] **Por Fechas:** Mango Query filtra correctamente por rango `premiered`.
- [x] **Top Descargas:** Vista `by_downloads` ordena descendente.
- [x] **Por Actor:** Vista `by_actor` filtra contenidos donde participa el ID seleccionado.
- [x] **Por Género:** Vista `by_genre` agrupa contenidos.
- [x] **Colaboraciones:** Algoritmo MapReduce muestra correctamente conteo de co-actuación.
