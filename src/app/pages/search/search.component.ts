import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TvMazeService } from '../../../services/tvmaze.service';
import { CatalogService } from '../../../services/catalog.service';
import { TvMazeResult, TvMazeShow } from '../../../models/types';

@Component({
    selector: 'app-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './search.component.html',
    styleUrl: './search.component.css'
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
    inWatchlist(id: number) { return false; }
    toggleWatchlist(show: any) { }
    openTrailer(name: string) { }
    modalOpen = signal(false);
    loadingTrailer = signal(false);
    trailerError = signal(false);
    currentTrailerUrl = signal<any>(null);
    currentTrailerTitle = signal('');
    currentTrailerSource = signal(null);
    closeTrailer() { }
    hasSearched = signal(false);
    getYear(d: string | null) { return d ? d.split('-')[0] : ''; }
}
