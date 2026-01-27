import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TvMazeService } from '../../services/tvmaze.service';
import { WatchlistService } from '../../services/watchlist.service';
import { CatalogService } from '../../services/catalog.service';
import { GeminiService } from '../../services/gemini.service';
import { TvMazeResult, TvMazeShow } from '../../models/types';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ... (Template igual al anterior, solo cambia la logica importToCatalog) ... -->
    <div class="p-6 max-w-7xl mx-auto">
      <header class="mb-10 text-center">
        <h1 class="text-4xl font-extrabold mb-3 text-gray-900 tracking-tight">Explorar TVMaze</h1>
        <p class="text-gray-500 text-lg">Encuentra series e impórtalas a CouchDB.</p>
      </header>
      
      <div class="max-w-3xl mx-auto mb-12 relative">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span class="material-icons text-gray-400">search</span>
        </div>
        <input type="text" [(ngModel)]="query" (keyup.enter)="search()"
          placeholder="Escribe el nombre de una serie..." 
          class="w-full pl-12 pr-32 py-4 text-lg bg-gray-900 text-white border border-gray-700 rounded-full shadow-lg focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
        >
        <button (click)="search()" class="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-full hover:bg-blue-700 font-semibold shadow-md active:scale-95">
          Buscar
        </button>
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
           <div class="col-span-4 text-center text-gray-500">Cargando...</div>
        </div>
      }

      @if (!loading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          @for (item of results(); track item.show.id) {
            <div class="bg-white rounded-2xl overflow-hidden flex flex-col shadow-lg border border-gray-100 group hover:-translate-y-1 transition-transform">
              <div class="relative h-80 bg-gray-100 overflow-hidden">
                @if (item.show.image?.medium) {
                  <img [src]="item.show.image?.medium" class="w-full h-full object-cover">
                } @else {
                  <div class="flex items-center justify-center h-full text-gray-400"><span class="material-icons">broken_image</span></div>
                }
              </div>
              <div class="p-4 flex-1 flex flex-col">
                 <h3 class="font-bold text-lg mb-1">{{ item.show.name }}</h3>
                 <div class="mt-auto pt-4 flex gap-2">
                   <button (click)="importToCatalog(item.show)" class="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 rounded font-bold text-sm flex items-center justify-center gap-1">
                     <span class="material-icons text-sm">cloud_upload</span> CouchDB
                   </button>
                 </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SearchComponent {
  private tvMazeService = inject(TvMazeService);
  private catalogService = inject(CatalogService);
  
  query = '';
  results = signal<TvMazeResult[]>([]);
  loading = signal(false);
  skeletons = [1, 2, 3, 4];

  search() {
    if (!this.query.trim()) return;
    this.loading.set(true);
    this.tvMazeService.searchShows(this.query).subscribe(res => {
      this.results.set(res);
      this.loading.set(false);
    });
  }

  importToCatalog(show: TvMazeShow): void {
    // Map TvMaze to CouchDB Content Model
    this.catalogService.importFromTvMaze({
      contentType: 'SERIE',
      name: show.name,
      genres: show.genres,
      premiered: show.premiered || undefined,
      rating: show.rating.average || 0
    });
    alert(`Serie "${show.name}" enviada a la cola de importación de CouchDB.`);
  }

  // Métodos auxiliares para la vista simplificados
  getRating(show: any) { return show.rating?.average || 0; }
  inWatchlist(id: number) { return false; } // Watchlist local legacy
  toggleWatchlist(show: any) {}
  openTrailer(name: string) {}
  modalOpen = signal(false);
  loadingTrailer = signal(false);
  trailerError = signal(false);
  currentTrailerUrl = signal<any>(null);
  currentTrailerTitle = signal('');
  currentTrailerSource = signal(null);
  closeTrailer() {}
  hasSearched = signal(false);
  getYear(d: string|null) { return d ? d.split('-')[0] : ''; }
}
