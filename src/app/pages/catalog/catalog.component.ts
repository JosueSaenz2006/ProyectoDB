import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../../services/catalog.service';
import { CouchDbService } from '../../../services/couchdb.service';
import { Content, ContentPopulated } from '../../../models/types';

@Component({
    selector: 'app-catalog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './catalog.component.html',
    styleUrl: './catalog.component.css'
})
export class CatalogComponent {
    catalogService = inject(CatalogService);
    private db = inject(CouchDbService);
    viewMode = signal<'list' | 'create'>('list');
    generosInput = '';
    awardsInput = ''; // Input para premios separados por coma

    newItem: Content = {
        type: 'content',
        contentType: 'MOVIE',
        name: '',
        genres: [],
        premiered: '',
        awards: [], // Ahora es string[]
        downloads: 0,
        rating: 0,
        mainCastId: '',
        castIds: []
    };

    save() {
        // Preparar objeto
        this.newItem.genres = this.generosInput.split(',').map(g => g.trim()).filter(g => g);
        this.newItem.awards = this.awardsInput.split(',').map(a => a.trim()).filter(a => a);
        // Añadir principal al reparto
        if (this.newItem.mainCastId) {
            this.newItem.castIds = [this.newItem.mainCastId];
        }

        this.catalogService.addContent(this.newItem).subscribe({
            next: () => {
                alert('Guardado en CouchDB');
                this.catalogService.refreshData();
                this.resetForm();
                this.viewMode.set('list');
            },
            error: (err) => alert('Error al guardar: ' + err.message)
        });
    }

    resetForm() {
        this.newItem = {
            type: 'content',
            contentType: 'MOVIE',
            name: '',
            genres: [],
            premiered: '',
            awards: [],
            downloads: 0,
            rating: 0,
            mainCastId: '',
            castIds: []
        };
        this.generosInput = '';
        this.awardsInput = '';
    }

    deleteItem(item: Content) {
        if (!confirm(`¿Eliminar ${item.name}?`)) return;
        if (item._id && item._rev) {
            this.catalogService.deleteContent(item._id, item._rev).subscribe(() => {
                this.catalogService.refreshData();
            });
        }
    }

    // Simular descarga: incrementa downloads y persiste en CouchDB
    simulateDownload(item: ContentPopulated) {
        if (!item._id || !item._rev) return;

        // Crear copia del doc para actualizar
        const updatedDoc: Content = {
            _id: item._id,
            _rev: item._rev,
            type: 'content',
            contentType: item.contentType,
            name: item.name,
            genres: item.genres,
            premiered: item.premiered,
            awards: item.awards,
            downloads: (item.downloads || 0) + 1,
            rating: item.rating,
            mainCastId: item.mainCastId,
            castIds: item.castIds,
            seasons: item.seasons,
            video: item.video,
            image: item.image
        };

        this.db.update(updatedDoc).subscribe({
            next: () => {
                this.catalogService.refreshData();
            },
            error: (err) => console.error('Error simulando descarga:', err)
        });
    }
}
