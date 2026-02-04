import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TvMazeService } from '../../../services/tvmaze.service';
import { CatalogService } from '../../../services/catalog.service';
import { GeminiService } from '../../../services/gemini.service';
import { WatchlistService } from '../../../services/watchlist.service';
import { TvMazeResult, TvMazeShow, WatchlistItem } from '../../../models/types';

// Interfaz extendida para incluir traducciones
interface ShowWithTranslation extends TvMazeShow {
    summaryEs?: string;
    nameEs?: string;
    genresEs?: string[];
    videoId?: string;
    videoUrl?: string;
    videoValidated?: boolean;
}

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
    private geminiService = inject(GeminiService);
    private sanitizer = inject(DomSanitizer);
    watchlistService = inject(WatchlistService);

    query = '';
    results = signal<TvMazeResult[]>([]);
    loading = signal(false);
    hasSearched = signal(false);
    skeletons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Stats (mock data - can be connected to real services)
    totalInDb = 12847;
    watchlistCount = 156;
    pendingCount = 23;

    // Modal state
    selectedShow = signal<ShowWithTranslation | null>(null);
    currentVideoUrl = signal<SafeResourceUrl | null>(null);
    isLoadingVideo = signal(false);
    isLoadingTranslation = signal(false);
    videoError = signal<string | null>(null);
    saveStatus = signal<{ message: string; isNew: boolean } | null>(null);

    // Manual video input
    manualVideoUrl = '';
    isValidatingManualVideo = signal(false);
    manualVideoError = signal<string | null>(null);
    showManualInput = signal(false);

    search() {
        if (!this.query.trim()) return;
        this.loading.set(true);
        this.hasSearched.set(true);
        this.selectedShow.set(null);

        // Siempre buscar en inglés con TVMaze (mejores resultados)
        this.tvMazeService.searchShows(this.query).subscribe(async res => {
            if (res.length > 0) {
                this.results.set(res);
                this.loading.set(false);
            } else {
                // Fallback: usar Gemini si TVMaze no encuentra nada
                this.performGeminiSearch(this.query);
            }
        });
    }

    async performGeminiSearch(query: string) {
        const geminiResult = await this.geminiService.searchSeries(query, true);
        if (geminiResult) {
            const mockResult: TvMazeResult = {
                score: 1.0,
                show: {
                    id: Math.floor(Math.random() * 100000),
                    url: '',
                    name: geminiResult.name,
                    type: 'Scripted',
                    language: 'English',
                    genres: geminiResult.genres || [],
                    status: 'Ended',
                    premiered: geminiResult.premiered || null,
                    rating: { average: geminiResult.rating?.average || 0 },
                    image: geminiResult.image || null,
                    summary: geminiResult.summary || '',
                    // Agregar traducciones
                    summaryEs: geminiResult.summaryEs,
                    nameEs: geminiResult.nameEs,
                    genresEs: geminiResult.genresEs,
                    network: geminiResult.network
                } as any
            };
            this.results.set([mockResult]);
        } else {
            this.results.set([]);
        }
        this.loading.set(false);
    }

    async importToCatalog(show: ShowWithTranslation, videoData?: { videoId: string; sourceUrl: string; validated: boolean }): Promise<{ success: boolean; message: string; isNew: boolean }> {
        const contentToSave: any = {
            contentType: 'SERIE',
            name: show.name,
            nameEs: show.nameEs || show.name,
            genres: show.genres,
            genresEs: show.genresEs || show.genres,
            premiered: show.premiered || undefined,
            rating: show.rating?.average || 0,
            summary: show.summary,
            summaryEs: show.summaryEs || '',
            seasons: [],
            image: show.image?.original || show.image?.medium
        };

        // Solo guardar video si está validado
        if (videoData && videoData.validated && videoData.videoId) {
            contentToSave.video = {
                url: videoData.sourceUrl || `https://www.youtube.com/watch?v=${videoData.videoId}`,
                filename: videoData.videoId,
                validated: true
            };
        }

        // Pasar el showId de TVMaze para obtener el cast real
        const tvMazeShowId = show.id; // ID numérico de TVMaze
        const result = await this.catalogService.importFromTvMaze(contentToSave, tvMazeShowId);
        this.saveStatus.set({ message: result.message, isNew: result.isNew });
        return result;
    }

    // Modal methods
    async openDetail(show: TvMazeShow): Promise<void> {
        const showWithTranslation: ShowWithTranslation = { ...show };
        this.selectedShow.set(showWithTranslation);
        this.currentVideoUrl.set(null);
        this.videoError.set(null);
        this.isLoadingVideo.set(true);
        this.isLoadingTranslation.set(true);
        document.body.style.overflow = 'hidden';

        // 0. Verificar si ya existe en la BD con video guardado
        const contentId = this.generateContentId(show.name);
        const existingContent = await this.catalogService.contentExists(contentId, 'SERIE');

        let existingVideoId: string | null = null;
        let existingSummaryEs: string | null = null;

        if (existingContent.exists && existingContent.doc) {
            console.log('📦 Contenido encontrado en BD:', existingContent.doc);

            // Obtener video existente
            if (existingContent.doc.video?.url) {
                const videoIdMatch = existingContent.doc.video.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (videoIdMatch) {
                    existingVideoId = videoIdMatch[1];
                    console.log('🎬 Video encontrado en BD:', existingVideoId);
                }
            }

            // Obtener descripción existente
            const existingDesc = await this.catalogService.getDescription(contentId);
            console.log('📝 Descripción desde BD:', existingDesc);

            // Verificar si tiene summaryEs válido (no vacío)
            if (existingDesc?.summaryEs && existingDesc.summaryEs.trim().length > 0) {
                existingSummaryEs = existingDesc.summaryEs;
                showWithTranslation.summaryEs = existingSummaryEs;
                console.log('✓ Usando descripción en español de la BD');
            } else {
                console.log('⚠ No hay summaryEs válido en la BD, se necesita traducción');
            }
        }

        // 1. Traducir sinopsis al español (si no hay existente)
        const translationPromise = (async () => {
            if (existingSummaryEs) {
                // Ya tenemos la traducción de la BD
                this.isLoadingTranslation.set(false);
                return;
            }

            // Si no hay traducción existente, debemos traducir
            if (show.summary) {
                const summaryEs = await this.geminiService.translateShowSummary(show.summary);
                showWithTranslation.summaryEs = summaryEs;

                if (show.genres && show.genres.length > 0) {
                    showWithTranslation.genresEs = await this.translateGenresLocally(show.genres);
                }

                this.selectedShow.set({ ...showWithTranslation });

                // Si ya existe en la BD pero no tenía descripción en español, actualizarla
                if (existingContent.exists && summaryEs) {
                    await this.catalogService.saveDescription(contentId, show.summary, summaryEs);
                    console.log('📝 Descripción en español actualizada en BD');
                }
            }
            this.isLoadingTranslation.set(false);
        })();

        // 2. Manejar video (desde BD o buscar nuevo)
        const videoPromise = (async () => {
            try {
                // Si ya tenemos video de la BD, usarlo directamente
                if (existingVideoId) {
                    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                        `https://www.youtube.com/embed/${existingVideoId}?rel=0&autoplay=0`
                    );
                    this.currentVideoUrl.set(safeUrl);
                    showWithTranslation.videoId = existingVideoId;
                    showWithTranslation.videoValidated = true;
                    console.log('✓ Video cargado desde BD');
                } else {
                    // Buscar video nuevo
                    const videoResult = await this.geminiService.getTrailerVideoId(show.name);

                    if (videoResult.videoId && videoResult.validated) {
                        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                            `https://www.youtube.com/embed/${videoResult.videoId}?rel=0&autoplay=0`
                        );
                        this.currentVideoUrl.set(safeUrl);

                        showWithTranslation.videoId = videoResult.videoId;
                        showWithTranslation.videoUrl = videoResult.sourceUrl || `https://www.youtube.com/watch?v=${videoResult.videoId}`;
                        showWithTranslation.videoValidated = true;

                        await translationPromise;
                        this.importToCatalog(showWithTranslation, {
                            videoId: videoResult.videoId,
                            sourceUrl: videoResult.sourceUrl || '',
                            validated: true
                        });
                    } else {
                        this.videoError.set('No se encontró un trailer disponible para embeber.');
                        await translationPromise;
                        if (!existingContent.exists) {
                            this.importToCatalog(showWithTranslation);
                        }
                    }
                }
            } catch (e) {
                this.videoError.set('Error al buscar el trailer.');
                await translationPromise;
                if (!existingContent.exists) {
                    this.importToCatalog(showWithTranslation);
                }
            }
            this.isLoadingVideo.set(false);
        })();

        await Promise.all([translationPromise, videoPromise]);
        this.selectedShow.set({ ...showWithTranslation });
    }

    // Helper para generar ID de contenido (mismo formato que catalog.service)
    private generateContentId(name: string): string {
        const slug = name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '')
            .trim()
            .replace(/\s+/g, '_');
        return `title:${slug}`;
    }

    // Traducción local de géneros (sin llamar a Gemini)
    private translateGenresLocally(genres: string[]): string[] {
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

    closeDetail(): void {
        this.selectedShow.set(null);
        this.currentVideoUrl.set(null);
        this.videoError.set(null);
        this.saveStatus.set(null);
        this.manualVideoUrl = '';
        this.showManualInput.set(false);
        this.manualVideoError.set(null);
        document.body.style.overflow = 'auto';
    }

    // Toggle manual video input
    toggleManualInput(): void {
        this.showManualInput.set(!this.showManualInput());
        this.manualVideoError.set(null);
    }

    // Extraer video ID de URL de YouTube
    private extractYouTubeId(url: string): string | null {
        const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }

    // Validar y aplicar video manual de YouTube
    async applyManualVideo(): Promise<void> {
        if (!this.manualVideoUrl.trim()) {
            this.manualVideoError.set('Por favor ingresa una URL de YouTube');
            return;
        }

        const videoId = this.extractYouTubeId(this.manualVideoUrl);
        if (!videoId) {
            this.manualVideoError.set('URL de YouTube inválida. Usa el formato: https://www.youtube.com/watch?v=XXXXXXXXXXX');
            return;
        }

        this.isValidatingManualVideo.set(true);
        this.manualVideoError.set(null);

        try {
            // Validar que el video exista
            const isValid = await this.geminiService.validateYouTubeVideo(videoId);

            if (isValid) {
                // Aplicar el video
                const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                    `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`
                );
                this.currentVideoUrl.set(safeUrl);
                this.videoError.set(null);
                this.showManualInput.set(false);

                // Actualizar el show con el video
                const currentShow = this.selectedShow();
                if (currentShow) {
                    currentShow.videoId = videoId;
                    currentShow.videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    currentShow.videoValidated = true;
                    this.selectedShow.set({ ...currentShow });

                    // Guardar en CouchDB con el video manual
                    const result = await this.importToCatalog(currentShow, {
                        videoId: videoId,
                        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        validated: true
                    });

                    this.saveStatus.set({
                        message: `Video agregado manualmente. ${result.message}`,
                        isNew: result.isNew
                    });
                }
            } else {
                this.manualVideoError.set('El video no existe o no está disponible para embeber. Intenta con otro enlace.');
            }
        } catch (e) {
            this.manualVideoError.set('Error al validar el video. Por favor intenta de nuevo.');
        }

        this.isValidatingManualVideo.set(false);
    }

    // Manejar archivo de video subido
    async handleVideoUpload(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];

        // Validar tipo de archivo
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (!allowedTypes.includes(file.type)) {
            this.manualVideoError.set('Formato no soportado. Usa MP4, WebM u OGG.');
            return;
        }

        // Validar tamaño (máximo 50MB para CouchDB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            this.manualVideoError.set('El archivo es muy grande. Máximo 50MB.');
            return;
        }

        this.isValidatingManualVideo.set(true);
        this.manualVideoError.set(null);

        try {
            // Crear URL local para previsualizar
            const localUrl = URL.createObjectURL(file);
            const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(localUrl);
            this.currentVideoUrl.set(safeUrl);
            this.videoError.set(null);
            this.showManualInput.set(false);

            // Actualizar el show
            const currentShow = this.selectedShow();
            if (currentShow) {
                currentShow.videoId = `local:${file.name}`;
                currentShow.videoUrl = localUrl;
                currentShow.videoValidated = true;
                this.selectedShow.set({ ...currentShow });

                // Guardar referencia en CouchDB (sin el archivo real por ahora)
                const result = await this.importToCatalog(currentShow, {
                    videoId: `uploaded:${file.name}`,
                    sourceUrl: `local://${file.name}`,
                    validated: true
                });

                this.saveStatus.set({
                    message: `Video "${file.name}" cargado. ${result.message}`,
                    isNew: result.isNew
                });
            }
        } catch (e) {
            this.manualVideoError.set('Error al cargar el video.');
        }

        this.isValidatingManualVideo.set(false);
    }

    // Helper methods
    getRating(show: TvMazeShow): number {
        return show.rating?.average || 0;
    }

    getYear(premiered: string | null): string {
        return premiered ? premiered.split('-')[0] : 'N/A';
    }

    // Obtener la sinopsis (preferir español si está disponible)
    getSummary(show: TvMazeShow | ShowWithTranslation): string {
        const extended = show as ShowWithTranslation;
        // Limpiar HTML
        const summary = extended.summaryEs || show.summary || '';
        return summary.replace(/<[^>]*>/g, '');
    }

    // Obtener géneros (preferir español)
    getGenres(show: TvMazeShow | ShowWithTranslation): string[] {
        const extended = show as ShowWithTranslation;
        return extended.genresEs || show.genres || [];
    }

    getCardGradient(show: TvMazeShow): string {
        const rating = this.getRating(show);
        if (rating >= 8.5) {
            return 'linear-gradient(135deg, #d4af37 0%, #0f1629 100%)';
        } else if (rating >= 7.5) {
            return 'linear-gradient(135deg, #14b8a6 0%, #0f1629 100%)';
        } else if (rating >= 6) {
            return 'linear-gradient(135deg, #2563eb 0%, #0f1629 100%)';
        }
        return 'linear-gradient(135deg, #1e3a5f 0%, #0f1629 100%)';
    }

    // Agregar a watchlist con todos los datos
    addToWatchlist(show: ShowWithTranslation): void {
        const year = show.premiered ? show.premiered.split('-')[0] : 'Sin año';

        const item: WatchlistItem = {
            serie_id: show.id,
            titulo_formateado: `${show.name} (${year})`,
            es_top: (show.rating?.average || 0) >= 8,
            name: show.name,
            image: show.image?.original || show.image?.medium,
            summaryEs: show.summaryEs || this.getSummary(show),
            genres: show.genresEs || show.genres || [],
            rating: show.rating?.average || 0,
            videoId: show.videoId,
            premiered: show.premiered || undefined
        };

        if (this.watchlistService.isInWatchlist(show.id)) {
            this.watchlistService.removeById(show.id);
        } else {
            this.watchlistService.add(item);
        }
    }
}
