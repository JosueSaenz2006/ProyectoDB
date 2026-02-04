/**
 * Setup CouchDB para MegaBuscador TV
 * Ejecutar con: node scripts/setup_couchdb.js
 * 
 * Este script:
 * 1. Crea la base de datos si no existe
 * 2. Crea los índices Mango necesarios
 * 3. Crea el design doc con las vistas para reportes
 * 4. Carga los datos semilla
 */

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const DB_NAME = process.env.DB_NAME || 'peliculas_db';
const USERNAME = process.env.COUCHDB_USER || 'admin';
const PASSWORD = process.env.COUCHDB_PASSWORD || 'password';

const AUTH = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

async function request(path, options = {}) {
    const url = `${COUCHDB_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`,
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();

    try {
        return { ok: response.ok, status: response.status, data: JSON.parse(text) };
    } catch {
        return { ok: response.ok, status: response.status, data: text };
    }
}

async function createDatabase() {
    console.log(`\n📦 Creando base de datos '${DB_NAME}'...`);
    const res = await request(`/${DB_NAME}`, { method: 'PUT' });
    if (res.ok) {
        console.log('✅ Base de datos creada');
    } else if (res.status === 412) {
        console.log('ℹ️  Base de datos ya existe');
    } else {
        console.error('❌ Error:', res.data);
    }
}

async function createIndexes() {
    console.log('\n📇 Creando índices Mango...');

    const indexes = [
        { name: 'idx_type', fields: ['type'] },
        { name: 'idx_type_contentType', fields: ['type', 'contentType'] },
        { name: 'idx_premiered', fields: ['premiered'] },
        { name: 'idx_downloads', fields: ['downloads'] },
        { name: 'idx_genres', fields: ['genres'] },
        { name: 'idx_mainCastId', fields: ['mainCastId'] },
        { name: 'idx_castIds', fields: ['castIds'] }
    ];

    for (const idx of indexes) {
        const res = await request(`/${DB_NAME}/_index`, {
            method: 'POST',
            body: JSON.stringify({
                index: { fields: idx.fields },
                name: idx.name,
                type: 'json'
            })
        });
        console.log(`  ${res.ok ? '✅' : '⚠️'} ${idx.name}`);
    }
}

async function createDesignDoc() {
    console.log('\n📐 Creando Design Document para reportes...');

    const designDoc = {
        _id: '_design/reports',
        views: {
            // Vista 1: Por fecha de estreno
            by_releaseDate: {
                map: `function(doc) {
                    if (doc.type === 'content' && doc.premiered) {
                        emit(doc.premiered, null);
                    }
                }`
            },
            // Vista 2: Por descargas (para Top N)
            by_downloads: {
                map: `function(doc) {
                    if (doc.type === 'content' && typeof doc.downloads === 'number') {
                        emit(doc.downloads, null);
                    }
                }`
            },
            // Vista 3: Por actor (para búsqueda por actor)
            by_actor: {
                map: `function(doc) {
                    if (doc.type === 'content' && doc.castIds) {
                        doc.castIds.forEach(function(actorId) {
                            emit([actorId, doc.premiered || ''], null);
                        });
                    }
                }`
            },
            // Vista 4: Por género
            by_genre: {
                map: `function(doc) {
                    if (doc.type === 'content' && doc.genres) {
                        doc.genres.forEach(function(genre) {
                            emit([genre, doc.premiered || ''], null);
                        });
                    }
                }`
            },
            // Vista 5: Colaboraciones entre actores (MapReduce)
            collaborations: {
                map: `function(doc) {
                    if (doc.type === 'content' && doc.castIds && doc.castIds.length > 1) {
                        for (var i = 0; i < doc.castIds.length; i++) {
                            for (var j = 0; j < doc.castIds.length; j++) {
                                if (i !== j) {
                                    emit([doc.castIds[i], doc.castIds[j]], 1);
                                }
                            }
                        }
                    }
                }`,
                reduce: '_sum'
            }
        }
    };

    // Eliminar design doc existente si lo hay
    const existing = await request(`/${DB_NAME}/_design/reports`);
    if (existing.ok && existing.data._rev) {
        await request(`/${DB_NAME}/_design/reports?rev=${existing.data._rev}`, { method: 'DELETE' });
    }

    const res = await request(`/${DB_NAME}/_design/reports`, {
        method: 'PUT',
        body: JSON.stringify(designDoc)
    });

    console.log(res.ok ? '✅ Design doc creado' : `❌ Error: ${JSON.stringify(res.data)}`);
}

async function loadSeedData() {
    console.log('\n🌱 Cargando datos semilla...');

    const fs = require('fs');
    const path = require('path');

    const seedPath = path.join(__dirname, 'seed.json');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    // Verificar qué docs ya existen para no duplicar
    const existingIds = [];
    for (const doc of seedData.docs) {
        const check = await request(`/${DB_NAME}/${encodeURIComponent(doc._id)}`);
        if (check.ok) {
            existingIds.push(doc._id);
        }
    }

    const docsToInsert = seedData.docs.filter(d => !existingIds.includes(d._id));

    if (docsToInsert.length === 0) {
        console.log('ℹ️  Todos los datos ya existen');
        return;
    }

    const res = await request(`/${DB_NAME}/_bulk_docs`, {
        method: 'POST',
        body: JSON.stringify({ docs: docsToInsert })
    });

    if (res.ok) {
        console.log(`✅ ${docsToInsert.length} documentos insertados`);
    } else {
        console.error('❌ Error:', res.data);
    }
}

async function enableCors() {
    console.log('\n🌐 Habilitando CORS...');

    const corsSettings = [
        ['httpd/enable_cors', '"true"'],
        ['cors/origins', '"*"'],
        ['cors/credentials', '"true"'],
        ['cors/methods', '"GET, PUT, POST, HEAD, DELETE"'],
        ['cors/headers', '"accept, authorization, content-type, origin, referer"']
    ];

    for (const [key, value] of corsSettings) {
        await request(`/_node/nonode@nohost/_config/${key}`, {
            method: 'PUT',
            body: value
        });
    }
    console.log('✅ CORS habilitado');
}

async function main() {
    console.log('🚀 Setup CouchDB para MegaBuscador TV');
    console.log(`   URL: ${COUCHDB_URL}`);
    console.log(`   DB:  ${DB_NAME}`);
    console.log(`   User: ${USERNAME}`);

    try {
        // Verificar conexión
        const check = await request('/');
        if (!check.ok) {
            console.error('❌ No se puede conectar a CouchDB. ¿Está corriendo?');
            process.exit(1);
        }
        console.log(`✅ CouchDB v${check.data.version} conectado`);

        await enableCors();
        await createDatabase();
        await createIndexes();
        await createDesignDoc();
        await loadSeedData();

        console.log('\n🎉 ¡Setup completado! La app está lista para usar.\n');
        console.log('   Ejecuta: npm run dev');
        console.log(`   Fauxton: ${COUCHDB_URL}/_utils`);

    } catch (e) {
        console.error('❌ Error fatal:', e);
        process.exit(1);
    }
}

main();
