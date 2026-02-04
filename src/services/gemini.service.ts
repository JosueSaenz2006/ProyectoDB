import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { environment } from '../environments/environment';

// Cache de videos validados (en memoria para evitar búsquedas repetidas)
interface VideoCache {
  [showName: string]: {
    videoId: string;
    sourceUrl: string;
    validated: boolean;
    timestamp: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private videoCache: VideoCache = {};

  constructor() {
    // Inicializar Gemini con la API Key del entorno
    const apiKey = environment.geminiApiKey;
    if (!apiKey) {
      console.warn('Gemini API Key is missing in environments/environment.ts');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-to-prevent-crash' });
  }

  /**
   * Traduce texto al español usando Gemini
   */
  async translateToSpanish(text: string): Promise<string> {
    if (!text || text.trim() === '') return text;

    try {
      const prompt = `Translate the following text to Spanish. Return ONLY the translated text, nothing else. Remove any HTML tags and return clean text:
      
"${text}"`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      return response.text?.trim() || text;
    } catch (e) {
      console.error('Error translating text:', e);
      return text; // Retorna original si falla
    }
  }

  /**
   * Busca un video de YouTube para una serie/película con validación
   * Extrae TODOS los videos posibles y valida cada uno
   */
  async getTrailerVideoId(showName: string, existingVideoId?: string): Promise<{ videoId: string | null, sourceUrl: string | null, validated: boolean }> {
    // Si ya tenemos un video guardado, verificar si funciona
    if (existingVideoId) {
      const isValid = await this.validateYouTubeVideo(existingVideoId);
      if (isValid) {
        return { videoId: existingVideoId, sourceUrl: `https://www.youtube.com/watch?v=${existingVideoId}`, validated: true };
      }
    }

    // Revisar cache en memoria
    const cached = this.videoCache[showName.toLowerCase()];
    if (cached && cached.validated && (Date.now() - cached.timestamp) < 3600000) {
      return { videoId: cached.videoId, sourceUrl: cached.sourceUrl, validated: true };
    }

    try {
      // Obtener TODOS los posibles video IDs de una búsqueda exhaustiva
      const allVideoIds = await this.searchAllYouTubeVideos(showName);

      console.log(`Encontrados ${allVideoIds.length} posibles videos para "${showName}"`);

      // Validar cada video hasta encontrar uno que funcione
      for (const videoData of allVideoIds) {
        console.log(`Validando video: ${videoData.videoId}...`);
        const isValid = await this.validateYouTubeVideo(videoData.videoId);

        if (isValid) {
          console.log(`✓ Video válido encontrado: ${videoData.videoId}`);
          // Guardar en cache
          this.videoCache[showName.toLowerCase()] = {
            videoId: videoData.videoId,
            sourceUrl: videoData.sourceUrl,
            validated: true,
            timestamp: Date.now()
          };
          return { videoId: videoData.videoId, sourceUrl: videoData.sourceUrl, validated: true };
        }
        console.log(`✗ Video ${videoData.videoId} no válido, probando siguiente...`);
      }

      return { videoId: null, sourceUrl: null, validated: false };

    } catch (e) {
      console.error('Error fetching trailer ID from Gemini:', e);
      return { videoId: null, sourceUrl: null, validated: false };
    }
  }

  /**
   * Busca exhaustivamente videos de YouTube usando múltiples queries
   * Retorna TODOS los video IDs encontrados (sin duplicados)
   */
  private async searchAllYouTubeVideos(showName: string): Promise<Array<{ videoId: string, sourceUrl: string }>> {
    const allVideos: Map<string, string> = new Map(); // videoId -> sourceUrl

    // Múltiples estrategias de búsqueda
    const searchQueries = [
      `${showName} trailer`,
      `${showName} official trailer`,
      `${showName} TV show trailer`,
      `${showName} series intro`,
      `${showName} opening`
    ];

    // Hacer UNA búsqueda con todas las queries para maximizar resultados
    const combinedQuery = `Find YouTube videos for the TV series "${showName}". Search for trailers, intros, promos, or clips.`;

    const prompt = `${combinedQuery}

IMPORTANT: I need you to find REAL YouTube video URLs that ACTUALLY EXIST.

Search Google for: "${showName} trailer site:youtube.com" OR "${showName} intro site:youtube.com"

List ALL YouTube video URLs you find in the search results. Return them as a simple list, one URL per line.

Example format:
https://www.youtube.com/watch?v=abc123xyz45
https://www.youtube.com/watch?v=def456uvw78

If you cannot find any videos, respond with: NO_VIDEOS_FOUND`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      // 1. Extraer de los chunks de grounding (MÁS CONFIABLE - son URLs reales)
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          const id = this.extractYouTubeId(chunk.web.uri);
          if (id && !allVideos.has(id)) {
            allVideos.set(id, chunk.web.uri);
          }
        }
      }

      // 2. Extraer de supportingSearchResults si existen
      const searchResults = (response.candidates?.[0]?.groundingMetadata as any)?.webSearchQueries || [];

      // 3. Extraer del texto de respuesta (buscar todas las URLs de YouTube)
      if (response.text) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
        let match;
        while ((match = youtubeRegex.exec(response.text)) !== null) {
          const id = match[1];
          if (id && !allVideos.has(id)) {
            allVideos.set(id, `https://www.youtube.com/watch?v=${id}`);
          }
        }
      }

      // Si no encontramos nada, intentar búsquedas más específicas
      if (allVideos.size === 0) {
        for (const query of searchQueries) {
          const result = await this.searchSingleVideo(query);
          if (result.videoId && !allVideos.has(result.videoId)) {
            allVideos.set(result.videoId, result.sourceUrl);
          }
        }
      }

    } catch (e) {
      console.warn('Error en búsqueda exhaustiva:', e);
    }

    return Array.from(allVideos.entries()).map(([videoId, sourceUrl]) => ({ videoId, sourceUrl }));
  }

  /**
   * Búsqueda simple de un video
   */
  private async searchSingleVideo(searchQuery: string): Promise<{ videoId: string | null, sourceUrl: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Find ONE YouTube video URL for: "${searchQuery}". Return ONLY the URL, nothing else.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          const id = this.extractYouTubeId(chunk.web.uri);
          if (id) {
            return { videoId: id, sourceUrl: chunk.web.uri };
          }
        }
      }

      if (response.text) {
        const id = this.extractYouTubeId(response.text);
        if (id) {
          return { videoId: id, sourceUrl: `https://www.youtube.com/watch?v=${id}` };
        }
      }
    } catch (e) {
      // Ignorar errores individuales
    }
    return { videoId: null, sourceUrl: '' };
  }

  /**
   * Valida si un video de YouTube existe y es embebible
   * Usa múltiples métodos de validación
   */
  async validateYouTubeVideo(videoId: string): Promise<boolean> {
    // Validar formato básico del ID (11 caracteres alfanuméricos)
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      console.log(`ID inválido (formato): ${videoId}`);
      return false;
    }

    try {
      // Método 1: Verificar thumbnail con alta calidad (hqdefault existe solo si el video existe)
      const hqThumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const hqResponse = await fetch(hqThumbUrl, { method: 'HEAD' });

      if (hqResponse.ok) {
        // Si hqdefault existe, el video es real
        return true;
      }

      // Método 2: Intentar con thumbnail default (menos calidad pero más permisiva)
      const defaultThumbUrl = `https://img.youtube.com/vi/${videoId}/default.jpg`;
      const defaultResponse = await fetch(defaultThumbUrl, { method: 'HEAD' });

      if (defaultResponse.ok) {
        return true;
      }

      // Método 3: oEmbed como último recurso
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedResponse = await fetch(oembedUrl);

      return oembedResponse.ok;

    } catch (e) {
      console.warn('Error validando video:', videoId, e);
      return false;
    }
  }

  /**
   * Busca información de una serie y traduce al español si es necesario
   * Siempre busca en inglés para mejores resultados, luego traduce
   */
  async searchSeries(query: string, translateToEs: boolean = true): Promise<any> {
    try {
      const prompt = `Search for the TV series or movie "${query}". 
        Respond in ENGLISH.
        Return a valid JSON object (no markdown, just json) with this structure:
        {
            "name": "Original Series Name",
            "nameEs": null,
            "genres": ["Genre1", "Genre2"],
            "genresEs": null,
            "premiered": "YYYY-MM-DD",
            "rating": { "average": 8.5 },
            "summary": "Plot summary in English...",
            "summaryEs": null,
            "image": { "medium": "url_to_poster_if_found_or_null", "original": "url" },
            "network": { "name": "Network Name" }
        }
        If not found, return null.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text;
      if (!text) return null;

      // Clean markdown ```json ... ```
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr);

      // Si se requiere traducción al español
      if (result && translateToEs) {
        // Traducir nombre, géneros y sinopsis en paralelo
        const [nameEs, summaryEs, genresEs] = await Promise.all([
          this.translateToSpanish(result.name),
          this.translateToSpanish(result.summary || ''),
          this.translateGenres(result.genres || [])
        ]);

        result.nameEs = nameEs;
        result.summaryEs = summaryEs;
        result.genresEs = genresEs;
      }

      return result;

    } catch (e) {
      console.error('Gemini search error:', e);
      return null;
    }
  }

  /**
   * Traduce un array de géneros al español
   */
  private async translateGenres(genres: string[]): Promise<string[]> {
    if (!genres || genres.length === 0) return [];

    // Mapa de géneros comunes para evitar llamadas innecesarias
    const genreMap: { [key: string]: string } = {
      'Drama': 'Drama',
      'Comedy': 'Comedia',
      'Action': 'Acción',
      'Adventure': 'Aventura',
      'Horror': 'Terror',
      'Thriller': 'Suspenso',
      'Science-Fiction': 'Ciencia Ficción',
      'Sci-Fi': 'Ciencia Ficción',
      'Fantasy': 'Fantasía',
      'Romance': 'Romance',
      'Crime': 'Crimen',
      'Mystery': 'Misterio',
      'Documentary': 'Documental',
      'Animation': 'Animación',
      'Family': 'Familiar',
      'War': 'Guerra',
      'Western': 'Western',
      'Music': 'Musical',
      'History': 'Historia',
      'Sport': 'Deportes',
      'Sports': 'Deportes',
      'Biography': 'Biografía',
      'Supernatural': 'Sobrenatural',
      'Legal': 'Legal',
      'Medical': 'Médico'
    };

    return genres.map(g => genreMap[g] || g);
  }

  /**
   * Traduce la sinopsis de un show de TVMaze al español
   */
  async translateShowSummary(summary: string): Promise<string> {
    if (!summary) return '';
    // Limpiar HTML de TVMaze
    const cleanSummary = summary.replace(/<[^>]*>/g, '');
    return this.translateToSpanish(cleanSummary);
  }

  private extractYouTubeId(url: string): string | null {
    // Regex robusto para capturar el ID de 11 caracteres de cualquier formato de URL de YouTube
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }

  /**
   * Genera una biografía corta de un actor/actriz usando Gemini
   */
  async generateActorBio(actorName: string): Promise<string> {
    if (!actorName || actorName.trim() === '') return '';

    try {
      const prompt = `Genera una biografía breve (3-4 oraciones) en ESPAÑOL sobre el actor/actriz "${actorName}".
      
Incluye:
- Nacionalidad y fecha de nacimiento aproximada
- Trabajos más conocidos (series/películas)
- Algún dato interesante de su carrera

Responde SOLO con el texto de la biografía, sin títulos ni formato especial.
Si no encuentras información, responde con un texto genérico breve.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      return response.text?.trim() || `${actorName} es un actor/actriz reconocido en la industria del entretenimiento.`;
    } catch (e) {
      console.error('Error generando bio de actor:', e);
      return `${actorName} es un actor/actriz reconocido en la industria del entretenimiento.`;
    }
  }
}