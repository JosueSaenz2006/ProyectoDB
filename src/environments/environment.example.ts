// =====================================================
// ARCHIVO DE EJEMPLO - COPIA ESTE ARCHIVO A environment.ts
// Y REEMPLAZA LAS CREDENCIALES CON LAS TUYAS
// =====================================================
// NO SUBIR environment.ts A GIT (está en .gitignore)
// =====================================================

export const environment = {
    production: false,

    // API Key de Gemini - Obtener en: https://aistudio.google.com/apikey
    geminiApiKey: 'TU_API_KEY_DE_GEMINI_AQUI',

    // Configuración de CouchDB
    couchdb: {
        host: 'localhost',
        port: 5984,
        user: 'TU_USUARIO',
        password: 'TU_PASSWORD'
    }
};
