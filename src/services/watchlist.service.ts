import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { WatchlistItem, TvMazeShow } from '../models/types';

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

  toggle(show: TvMazeShow): void {
    const currentList = this.watchlist();
    const exists = currentList.find(item => item.serie_id === show.id);

    if (exists) {
      // Eliminar
      const newList = currentList.filter(item => item.serie_id !== show.id);
      this.update(newList);
    } else {
      // Agregar con transformación EXACTA
      let year = '0000';
      if (show.premiered) {
        year = show.premiered.split('-')[0];
      } else {
        year = 'Sin año';
      }

      const newItem: WatchlistItem = {
        serie_id: show.id,
        titulo_formateado: `${show.name} (${year})`,
        es_top: (show.rating.average || 0) >= 8
      };

      this.update([...currentList, newItem]);
    }
  }

  removeById(id: number): void {
    const newList = this.watchlist().filter(item => item.serie_id !== id);
    this.update(newList);
  }

  private update(list: WatchlistItem[]): void {
    this.watchlist.set(list);
    this.storage.setItem(this.KEY, list);
  }
}
