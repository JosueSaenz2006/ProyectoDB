import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReportsService } from '../../../services/reports.service';
import { CatalogService } from '../../../services/catalog.service';
import { GeminiService } from '../../../services/gemini.service';
import { ContentPopulated, Person, Season } from '../../../models/types';

// Tipo para colaborador con info extendida
interface ActorCollabInfo {
    name: string;
    count: number;
    person?: Person;
    bio?: string;
    image?: string;
}

// Tipo para edición de contenido
interface EditableContent {
    _id: string;
    name: string;
    genres: string[];
    premiered: string;
    awards: string[];
    downloads: number;
    rating: number | null;
    contentType: 'MOVIE' | 'SERIE';
    mainCastId: string;
    castIds: string[];
    seasons?: Season[];
    videoUrl?: string;
    image?: string;
    summaryEs?: string;
}

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.css'
})
export class ReportsComponent {
    reportsService = inject(ReportsService);
    catalogService = inject(CatalogService);
    private geminiService = inject(GeminiService);
    private sanitizer = inject(DomSanitizer);

    tabs = [
        { id: 'dates', label: 'Fechas' },
        { id: 'downloads', label: 'Top Descargas' },
        { id: 'actor', label: 'Por Actor' },
        { id: 'genre', label: 'Por Género' },
        { id: 'collab', label: 'Colaboraciones' },
        { id: 'edit', label: 'Editar' },
    ];

    activeTab = signal('dates');
    reportResults = signal<ContentPopulated[]>([]);
    collabResults = signal<ActorCollabInfo[]>([]);

    // Inputs
    dateStart = '2000-01-01';
    dateEnd = '2026-01-01';
    selectedActorId = '';
    genreQuery = '';
    selectedCollabId = '';

    // Modal de Serie
    selectedContent = signal<ContentPopulated | null>(null);
    currentVideoUrl = signal<SafeResourceUrl | null>(null);

    // Modal de Actor
    selectedActor = signal<ActorCollabInfo | null>(null);
    isLoadingActorBio = signal(false);
    actorImageUrl = '';

    // === EDICIÓN ===
    selectedEditId = '';
    editingContent = signal<EditableContent | null>(null);
    isSaving = signal(false);
    saveMessage = signal<{ type: 'success' | 'error', text: string } | null>(null);

    // Campos de edición
    editGenresText = '';
    editAwardsText = '';
    editCastIdsText = '';

    setTab(id: string) {
        this.activeTab.set(id);
        this.reportResults.set([]);
        this.collabResults.set([]);
        this.editingContent.set(null);
        this.saveMessage.set(null);
        if (id === 'downloads') this.runDownloadsReport();
    }

    runDateReport() {
        this.reportsService.getByDateRange(this.dateStart, this.dateEnd).subscribe(res => this.reportResults.set(res));
    }

    runDownloadsReport() {
        this.reportsService.getTopDownloads().subscribe(res => this.reportResults.set(res));
    }

    runActorReport() {
        if (!this.selectedActorId) return;
        this.reportsService.getByActor(this.selectedActorId).subscribe(res => this.reportResults.set(res));
    }

    runGenreReport() {
        this.reportsService.getByGenre(this.genreQuery).subscribe(res => this.reportResults.set(res));
    }

    runCollabReport() {
        if (!this.selectedCollabId) return;
        this.reportsService.getCollaborators(this.selectedCollabId).subscribe(res => {
            const enriched = res.map(r => {
                const person = this.catalogService.persons().find(p => p.fullName === r.name);
                return { ...r, person } as ActorCollabInfo;
            });
            this.collabResults.set(enriched);
        });
    }

    // === EDICIÓN DE CONTENIDO ===

    loadContentForEdit(): void {
        if (!this.selectedEditId) {
            this.editingContent.set(null);
            return;
        }

        const content = this.catalogService.contents().find(c => c._id === this.selectedEditId);
        if (!content) return;

        const editable: EditableContent = {
            _id: content._id || '',
            name: content.name,
            genres: [...content.genres],
            premiered: content.premiered,
            awards: [...(content.awards || [])],
            downloads: content.downloads,
            rating: content.rating,
            contentType: content.contentType,
            mainCastId: content.mainCastId,
            castIds: [...content.castIds],
            seasons: content.seasons ? [...content.seasons] : undefined,
            videoUrl: content.video?.url || '',
            image: content.image || '',
            summaryEs: '' // Se cargará de descripción si existe
        };

        this.editingContent.set(editable);
        this.editGenresText = editable.genres.join(', ');
        this.editAwardsText = editable.awards.join(', ');
        this.editCastIdsText = editable.castIds.join(', ');
        this.saveMessage.set(null);
    }

    async saveContentChanges(): Promise<void> {
        const editable = this.editingContent();
        if (!editable) return;

        this.isSaving.set(true);
        this.saveMessage.set(null);

        try {
            // Parsear campos de texto a arrays
            editable.genres = this.editGenresText.split(',').map(g => g.trim()).filter(g => g);
            editable.awards = this.editAwardsText.split(',').map(a => a.trim()).filter(a => a);
            editable.castIds = this.editCastIdsText.split(',').map(c => c.trim()).filter(c => c);

            // Actualizar en CouchDB
            const success = await this.catalogService.updateContent(editable);

            if (success) {
                this.saveMessage.set({ type: 'success', text: '¡Cambios guardados correctamente!' });
                // Refrescar datos
                this.catalogService.refreshData();
            } else {
                this.saveMessage.set({ type: 'error', text: 'Error al guardar los cambios.' });
            }
        } catch (error) {
            console.error('Error guardando:', error);
            this.saveMessage.set({ type: 'error', text: 'Error inesperado al guardar.' });
        }

        this.isSaving.set(false);
    }

    // Agregar temporada
    addSeason(): void {
        const editable = this.editingContent();
        if (!editable) return;

        const seasons = editable.seasons || [];
        const nextNum = seasons.length > 0 ? Math.max(...seasons.map(s => s.seasonNumber)) + 1 : 1;
        seasons.push({ seasonNumber: nextNum, episodeCount: 10 });

        this.editingContent.set({ ...editable, seasons });
    }

    // Eliminar temporada
    removeSeason(index: number): void {
        const editable = this.editingContent();
        if (!editable || !editable.seasons) return;

        const seasons = [...editable.seasons];
        seasons.splice(index, 1);
        this.editingContent.set({ ...editable, seasons });
    }

    // === MODAL DE SERIE ===

    openContentDetail(content: ContentPopulated): void {
        this.selectedContent.set(content);
        document.body.style.overflow = 'hidden';

        if (content.video?.url) {
            const videoId = this.extractYouTubeId(content.video.url);
            if (videoId) {
                this.loadVideo(videoId);
            }
        } else {
            this.currentVideoUrl.set(null);
        }
    }

    closeContentDetail(): void {
        this.selectedContent.set(null);
        this.currentVideoUrl.set(null);
        document.body.style.overflow = 'auto';
    }

    private loadVideo(videoId: string): void {
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.youtube.com/embed/${videoId}?rel=0`
        );
        this.currentVideoUrl.set(safeUrl);
    }

    private extractYouTubeId(url: string): string | null {
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }

    // === MODAL DE ACTOR ===

    async openActorDetail(actor: ActorCollabInfo): Promise<void> {
        this.selectedActor.set(actor);
        this.actorImageUrl = actor.image || actor.person?.image || '';
        document.body.style.overflow = 'hidden';

        if (!actor.bio && actor.name) {
            this.isLoadingActorBio.set(true);
            try {
                const bio = await this.geminiService.generateActorBio(actor.name);
                const updated = { ...actor, bio };
                this.selectedActor.set(updated);

                const currentList = this.collabResults();
                const newList = currentList.map(a =>
                    a.name === actor.name ? updated : a
                );
                this.collabResults.set(newList);
            } catch (error) {
                console.error('Error generando bio:', error);
            }
            this.isLoadingActorBio.set(false);
        }
    }

    closeActorDetail(): void {
        this.selectedActor.set(null);
        this.actorImageUrl = '';
        document.body.style.overflow = 'auto';
    }

    async saveActorImage(): Promise<void> {
        const actor = this.selectedActor();
        if (!actor || !this.actorImageUrl.trim()) return;

        const updated = { ...actor, image: this.actorImageUrl };
        this.selectedActor.set(updated);

        const currentList = this.collabResults();
        const newList = currentList.map(a =>
            a.name === actor.name ? updated : a
        );
        this.collabResults.set(newList);

        if (actor.person?._id) {
            try {
                await this.catalogService.updatePersonImage(actor.person._id, this.actorImageUrl);
            } catch (error) {
                console.error('Error guardando imagen:', error);
            }
        }
    }

    // Helpers
    getYear(premiered?: string): string {
        return premiered ? premiered.split('-')[0] : 'N/A';
    }
}
