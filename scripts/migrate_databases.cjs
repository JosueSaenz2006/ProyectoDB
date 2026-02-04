// Script para migrar datos de peliculas_db a bases separadas
// Ejecutar: node scripts/migrate_databases.cjs

const http = require('http');

const CONFIG = {
    host: 'localhost',
    port: 5984,
    username: 'admin',
    password: 'admin'
};

const authString = CONFIG.username + ':' + CONFIG.password;
const auth = Buffer.from(authString).toString('base64');

function request(method, path, body) {
    return new Promise(function (resolve, reject) {
        var options = {
            hostname: CONFIG.host,
            port: CONFIG.port,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + auth
            }
        };

        var req = http.request(options, function (res) {
            var data = '';
            res.on('data', function (chunk) {
                data = data + chunk;
            });
            res.on('end', function () {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', function (e) {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    console.log('=== MIGRACION DE BASES DE DATOS ===\n');

    // 1. Obtener todos los docs de peliculas_db
    console.log('1. Obteniendo documentos de peliculas_db...');
    var result = await request('GET', '/peliculas_db/_all_docs?include_docs=true', null);

    if (result.status !== 200) {
        console.log('Error obteniendo docs:', result.body);
        return;
    }

    var docs = result.body.rows
        .filter(function (r) { return r.doc && !r.doc._id.startsWith('_design'); })
        .map(function (r) { return r.doc; });

    console.log('   Encontrados: ' + docs.length + ' documentos\n');

    var stats = { actores: 0, series: 0, peliculas: 0, errores: 0 };

    // 2. Migrar cada documento
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var id = doc._id;
        var rev = doc._rev;

        // Crear copia sin _rev
        var newDoc = JSON.parse(JSON.stringify(doc));
        delete newDoc._rev;

        if (id.startsWith('person:')) {
            // Migrar a actores_db
            console.log('[ACTOR] ' + (doc.fullName || id));
            var res = await request('POST', '/actores_db', newDoc);
            if (res.status === 201) {
                stats.actores++;
                // Eliminar de peliculas_db
                await request('DELETE', '/peliculas_db/' + encodeURIComponent(id) + '?rev=' + rev, null);
                console.log('        -> Movido a actores_db');
            } else {
                stats.errores++;
                console.log('        -> ERROR: ' + JSON.stringify(res.body));
            }
        }
        else if (id.startsWith('title:')) {
            // Es serie o pelicula
            var hasSeries = doc.contentType === 'SERIE' || (doc.seasons && doc.seasons.length > 0);

            if (hasSeries) {
                console.log('[SERIE] ' + (doc.name || id));
                var res = await request('POST', '/series_db', newDoc);
                if (res.status === 201) {
                    stats.series++;
                    await request('DELETE', '/peliculas_db/' + encodeURIComponent(id) + '?rev=' + rev, null);
                    console.log('        -> Movido a series_db');
                } else {
                    stats.errores++;
                    console.log('        -> ERROR: ' + JSON.stringify(res.body));
                }
            } else {
                console.log('[PELICULA] ' + (doc.name || id));
                console.log('        -> Se queda en peliculas_db');
                stats.peliculas++;
            }
        }
        else {
            console.log('[?] Documento ignorado: ' + id);
        }
    }

    // 3. Resumen
    console.log('\n=== RESUMEN ===');
    console.log('Actores migrados a actores_db: ' + stats.actores);
    console.log('Series migradas a series_db: ' + stats.series);
    console.log('Peliculas en peliculas_db: ' + stats.peliculas);
    console.log('Errores: ' + stats.errores);
    console.log('\nMigracion completada!');
}

run().catch(function (e) {
    console.error('Error:', e);
});
