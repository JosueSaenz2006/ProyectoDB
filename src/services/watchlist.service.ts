import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { WatchlistItem, TvMazeShow } from '../models/types';

// Interfaz extendida para el show con traducciones
interface ShowWithTranslation extends TvMazeShow {
  summaryEs?: string;
  genresEs?: string[];
  videoId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private storage = inject(StorageService);
  private readonly KEY = 'mi_watchlist';

  // Signal para reactividad en componentes
  watchlist = signal<WatchlistItem[]>(this.loadInitial());

  private loadInitial(): WatchlistItem[] {
    return this.storage.getItem<WatchlistItem[]>(this.KEY) || [];
  }

  isInWatchlist(id: number): boolean {
    return this.watchlist().some(item => item.serie_id === id);
  }

  getItem(id: number): WatchlistItem | undefined {
    return this.watchlist().find(item => item.serie_id === id);
  }

  // Agregar/quitar de watchlist con datos completos
  toggle(show: ShowWithTranslation): void {
    const currentList = this.watchlist();
    const exists = currentList.find(item => item.serie_id === show.id);

    if (exists) {
      // Eliminar
      const newList = currentList.filter(item => item.serie_id !== show.id);
      this.update(newList);
    } else {
      // Agregar con todos los datos
      let year = 'Sin año';
      if (show.premiered) {
        year = show.premiered.split('-')[0];
      }

      const newItem: WatchlistItem = {
        serie_id: show.id,
        titulo_formateado: `${show.name} (${year})`,
        es_top: (show.rating?.average || 0) >= 8,
        // Campos extendidos
        name: show.name,
        image: show.image?.original || show.image?.medium,
        summaryEs: show.summaryEs || '',
        genres: show.genresEs || show.genres || [],
        rating: show.rating?.average || 0,
        videoId: show.videoId,
        premiered: show.premiered || undefined,
        // Campos personales vacíos por defecto
        myRating: undefined,
        myReview: undefined
      };

      this.update([...currentList, newItem]);
    }
  }

  // Agregar directamente con todos los datos
  add(item: WatchlistItem): void {
    const currentList = this.watchlist();
    const exists = currentList.find(i => i.serie_id === item.serie_id);

    if (!exists) {
      this.update([...currentList, item]);
    }
  }

  removeById(id: number): void {
    const newList = this.watchlist().filter(item => item.serie_id !== id);
    this.update(newList);
  }

  // Actualizar video de un item
  updateVideo(id: number, videoId: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, videoId };
      }
      return item;
    });
    this.update(updated);
  }

  // Guardar calificación personal
  updateMyRating(id: number, rating: number): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, myRating: rating };
      }
      return item;
    });
    this.update(updated);
  }

  // Guardar reseña personal
  updateMyReview(id: number, review: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, myReview: review };
      }
      return item;
    });
    this.update(updated);
  }

  // Actualizar sinopsis en español
  updateSummaryEs(id: number, summaryEs: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, summaryEs };
      }
      return item;
    });
    this.update(updated);
  }

  // === MÚLTIPLES VIDEOS ===

  // Agregar un video a la lista
  addVideo(id: number, videoId: string, title?: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        const videos = item.videos || [];
        // No agregar si ya existe
        if (videos.some(v => v.id === videoId)) return item;
        const newVideos = [...videos, { id: videoId, title }];
        // Si es el primer video, también establecerlo como principal
        const newVideoId = item.videoId || videoId;
        return { ...item, videos: newVideos, videoId: newVideoId };
      }
      return item;
    });
    this.update(updated);
  }

  // Eliminar un video de la lista
  removeVideo(id: number, videoId: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        const videos = (item.videos || []).filter(v => v.id !== videoId);
        // Si eliminamos el video principal, poner el siguiente
        let newVideoId = item.videoId;
        if (item.videoId === videoId) {
          newVideoId = videos.length > 0 ? videos[0].id : undefined;
        }
        return { ...item, videos, videoId: newVideoId };
      }
      return item;
    });
    this.update(updated);
  }

  // Establecer video principal
  setMainVideo(id: number, videoId: string): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, videoId };
      }
      return item;
    });
    this.update(updated);
  }

  // === CONTADOR DE DESCARGAS/CLICKS ===

  // Incrementar contador de visualizaciones
  incrementDownloads(id: number): void {
    const currentList = this.watchlist();
    const updated = currentList.map(item => {
      if (item.serie_id === id) {
        return { ...item, downloads: (item.downloads || 0) + 1 };
      }
      return item;
    });
    this.update(updated);
  }

  private update(list: WatchlistItem[]): void {
    this.watchlist.set(list);
    this.storage.setItem(this.KEY, list);
  }
}

