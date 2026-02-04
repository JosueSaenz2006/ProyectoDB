import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WatchlistService } from '../../../services/watchlist.service';
import { GeminiService } from '../../../services/gemini.service';
import { WatchlistItem } from '../../../models/types';

@Component({
    selector: 'app-watchlist',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './watchlist.component.html',
    styleUrl: './watchlist.component.css'
})
export class WatchlistComponent {
    watchlistService = inject(WatchlistService);
    private geminiService = inject(GeminiService);
    private sanitizer = inject(DomSanitizer);

    // Modal state
    selectedItem = signal<WatchlistItem | null>(null);
    currentVideoUrl = signal<SafeResourceUrl | null>(null);
    isLoadingVideo = signal(false);

    // Edición de video
    showVideoInput = signal(false);
    manualVideoUrl = '';
    isValidatingVideo = signal(false);
    videoError = signal<string | null>(null);

    // Edición de reseña
    tempReview = '';
    isSavingReview = signal(false);

    // Estrellas para rating
    stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Abrir modal de detalle
    openDetail(item: WatchlistItem): void {
        this.selectedItem.set(item);
        this.tempReview = item.myReview || '';
        this.showVideoInput.set(false);
        this.videoError.set(null);
        document.body.style.overflow = 'hidden';

        // Cargar video si existe
        if (item.videoId) {
            this.loadVideo(item.videoId);
        } else {
            this.currentVideoUrl.set(null);
        }
    }

    // Cerrar modal
    closeDetail(): void {
        this.selectedItem.set(null);
        this.currentVideoUrl.set(null);
        this.showVideoInput.set(false);
        this.videoError.set(null);
        this.tempReview = '';
        document.body.style.overflow = 'auto';
    }

    // Cargar video de YouTube
    private loadVideo(videoId: string): void {
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.youtube.com/embed/${videoId}?rel=0`
        );
        this.currentVideoUrl.set(safeUrl);
    }

    // Toggle input de video
    toggleVideoInput(): void {
        this.showVideoInput.set(!this.showVideoInput());
        this.videoError.set(null);
        this.manualVideoUrl = '';
    }

    // Extraer ID de YouTube de URL
    private extractYouTubeId(url: string): string | null {
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }

    // Aplicar nuevo video
    async applyVideo(): Promise<void> {
        if (!this.manualVideoUrl.trim()) {
            this.videoError.set('Ingresa una URL de YouTube');
            return;
        }

        const videoId = this.extractYouTubeId(this.manualVideoUrl);
        if (!videoId) {
            this.videoError.set('URL de YouTube inválida');
            return;
        }

        this.isValidatingVideo.set(true);
        this.videoError.set(null);

        try {
            const isValid = await this.geminiService.validateYouTubeVideo(videoId);

            if (isValid) {
                const item = this.selectedItem();
                if (item) {
                    this.watchlistService.updateVideo(item.serie_id, videoId);
                    this.loadVideo(videoId);
                    this.selectedItem.set({ ...item, videoId });
                    this.showVideoInput.set(false);
                    this.manualVideoUrl = '';
                }
            } else {
                this.videoError.set('Video no disponible');
            }
        } catch {
            this.videoError.set('Error al validar');
        }

        this.isValidatingVideo.set(false);
    }

    // Guardar calificación personal
    saveRating(rating: number): void {
        const item = this.selectedItem();
        if (item) {
            this.watchlistService.updateMyRating(item.serie_id, rating);
            this.selectedItem.set({ ...item, myRating: rating });
        }
    }

    // Guardar reseña
    saveReview(): void {
        const item = this.selectedItem();
        if (item && this.tempReview !== item.myReview) {
            this.isSavingReview.set(true);
            this.watchlistService.updateMyReview(item.serie_id, this.tempReview);
            this.selectedItem.set({ ...item, myReview: this.tempReview });

            setTimeout(() => {
                this.isSavingReview.set(false);
            }, 500);
        }
    }

    // Eliminar de watchlist
    remove(id: number): void {
        this.watchlistService.removeById(id);
        this.closeDetail();
    }

    // Helpers
    getYear(premiered?: string): string {
        return premiered ? premiered.split('-')[0] : 'N/A';
    }

    // === MÚLTIPLES VIDEOS ===

    // Titulo del nuevo video
    newVideoTitle = '';

    // Agregar video a la lista
    async addVideoToList(): Promise<void> {
        if (!this.manualVideoUrl.trim()) {
            this.videoError.set('Ingresa una URL de YouTube');
            return;
        }

        const videoId = this.extractYouTubeId(this.manualVideoUrl);
        if (!videoId) {
            this.videoError.set('URL de YouTube inválida');
            return;
        }

        this.isValidatingVideo.set(true);
        this.videoError.set(null);

        try {
            const isValid = await this.geminiService.validateYouTubeVideo(videoId);

            if (isValid) {
                const item = this.selectedItem();
                if (item) {
                    const title = this.newVideoTitle.trim() || `Video ${(item.videos?.length || 0) + 1}`;
                    this.watchlistService.addVideo(item.serie_id, videoId, title);

                    // Actualizar estado local
                    const updatedVideos = [...(item.videos || []), { id: videoId, title }];
                    const updatedItem = {
                        ...item,
                        videos: updatedVideos,
                        videoId: item.videoId || videoId
                    };
                    this.selectedItem.set(updatedItem);

                    // Cargar el nuevo video si es el primero
                    if (!item.videoId) {
                        this.loadVideo(videoId);
                    }

                    this.manualVideoUrl = '';
                    this.newVideoTitle = '';
                    this.showVideoInput.set(false);
                }
            } else {
                this.videoError.set('Video no disponible');
            }
        } catch {
            this.videoError.set('Error al validar');
        }

        this.isValidatingVideo.set(false);
    }

    // Eliminar video de la lista
    removeVideoFromList(videoId: string): void {
        const item = this.selectedItem();
        if (item) {
            this.watchlistService.removeVideo(item.serie_id, videoId);

            const updatedVideos = (item.videos || []).filter(v => v.id !== videoId);
            const newMainVideo = item.videoId === videoId
                ? (updatedVideos.length > 0 ? updatedVideos[0].id : undefined)
                : item.videoId;

            this.selectedItem.set({ ...item, videos: updatedVideos, videoId: newMainVideo });

            if (newMainVideo) {
                this.loadVideo(newMainVideo);
            } else {
                this.currentVideoUrl.set(null);
            }
        }
    }

    // Seleccionar video para reproducir
    selectVideo(videoId: string): void {
        const item = this.selectedItem();
        if (item) {
            this.watchlistService.setMainVideo(item.serie_id, videoId);
            this.selectedItem.set({ ...item, videoId });
            this.loadVideo(videoId);

            // Incrementar contador de visualizaciones
            this.watchlistService.incrementDownloads(item.serie_id);
        }
    }
}

