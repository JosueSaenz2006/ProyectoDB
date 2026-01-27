#!/bin/bash

# Configuración
HOST="http://localhost:5984"
USER="admin"
PASS="password"
DB="streaming_db"
AUTH="$USER:$PASS"

echo "Esperando a CouchDB..."
sleep 5

# 1. Habilitar CORS (Crucial para Angular)
echo "Configurando CORS..."
curl -X PUT "$HOST/_node/nonode@nohost/_config/httpd/enable_cors" -d '"true"' -u $AUTH
curl -X PUT "$HOST/_node/nonode@nohost/_config/cors/origins" -d '"*"' -u $AUTH
curl -X PUT "$HOST/_node/nonode@nohost/_config/cors/credentials" -d '"true"' -u $AUTH
curl -X PUT "$HOST/_node/nonode@nohost/_config/cors/methods" -d '"GET, PUT, POST, HEAD, DELETE"' -u $AUTH
curl -X PUT "$HOST/_node/nonode@nohost/_config/cors/headers" -d '"accept, authorization, content-type, origin, referer"' -u $AUTH

# 2. Crear Base de Datos
echo "Creando base de datos '$DB'..."
curl -X PUT "$HOST/$DB" -u $AUTH

# 3. Crear Design Document (Vistas MapReduce)
echo "Subiendo Design Document..."
curl -X PUT "$HOST/$DB/_design/streaming" -u $AUTH -H "Content-Type: application/json" -d '{
  "views": {
    "by_release_date": {
      "map": "function(doc) { if (doc.type === \"content\" && doc.premiered) { emit(doc.premiered, null); } }"
    },
    "by_downloads": {
      "map": "function(doc) { if (doc.type === \"content\" && doc.downloads) { emit(doc.downloads, null); } }"
    },
    "by_genre": {
      "map": "function(doc) { if (doc.type === \"content\" && doc.genres) { doc.genres.forEach(function(g) { emit(g, null); }); } }"
    },
    "by_actor": {
      "map": "function(doc) { if (doc.type === \"content\" && doc.castIds) { doc.castIds.forEach(function(actorId) { emit(actorId, null); }); } }"
    },
    "collaborations": {
      "map": "function(doc) { if(doc.type == \"content\" && doc.castIds && doc.castIds.length > 1) { doc.castIds.forEach(function(a) { doc.castIds.forEach(function(b) { if(a !== b) { emit([a, b], 1); } }); }); } }",
      "reduce": "_sum"
    }
  }
}'

# 4. Crear Índices Mango
echo "Creando índices Mango..."
curl -X POST "$HOST/$DB/_index" -u $AUTH -H "Content-Type: application/json" -d '{
  "index": { "fields": ["premiered"] },
  "name": "idx_date",
  "type": "json"
}'

curl -X POST "$HOST/$DB/_index" -u $AUTH -H "Content-Type: application/json" -d '{
  "index": { "fields": ["genres"] },
  "name": "idx_genres",
  "type": "json"
}'

# 5. Cargar Seed Data
echo "Cargando datos semilla..."
curl -X POST "$HOST/$DB/_bulk_docs" -u $AUTH -H "Content-Type: application/json" -d @seed.json

echo "¡Setup completado! CouchDB listo en $HOST/$DB"
