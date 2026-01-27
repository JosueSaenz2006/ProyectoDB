import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Inicializar Gemini con la API Key del entorno
    const apiKey = (process.env as any)['API_KEY'];
    this.ai = new GoogleGenAI({ apiKey });
  }

  async getTrailerVideoId(showName: string): Promise<{ videoId: string | null, sourceUrl: string | null }> {
    try {
      // Usamos Google Search para encontrar un video REAL y VIGENTE en YouTube
      const prompt = `Find the youtube.com URL for the official trailer of the series or movie "${showName}".`;
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] // Activamos la búsqueda real
        }
      });

      // Extraer URLs de los chunks de grounding (fuentes reales encontradas en la web)
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      // 1. Prioridad: Buscar en los resultados de búsqueda web (Grounding)
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          const id = this.extractYouTubeId(chunk.web.uri);
          if (id) {
            return { videoId: id, sourceUrl: chunk.web.uri };
          }
        }
      }

      // 2. Fallback: Intentar parsear el texto si la IA escribió el link explícitamente aunque no venga en chunks
      if (response.text) {
         const id = this.extractYouTubeId(response.text);
         if (id) {
            return { videoId: id, sourceUrl: null };
         }
      }
      
      return { videoId: null, sourceUrl: null };

    } catch (e) {
      console.error('Error fetching trailer ID from Gemini:', e);
      return { videoId: null, sourceUrl: null };
    }
  }

  private extractYouTubeId(url: string): string | null {
    // Regex robusto para capturar el ID de 11 caracteres de cualquier formato de URL de YouTube
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }
}