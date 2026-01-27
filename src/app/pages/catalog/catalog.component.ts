import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../../services/catalog.service';
import { Content } from '../../../models/types';

@Component({
    selector: 'app-catalog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './catalog.component.html',
    styleUrl: './catalog.component.css'
})
export class CatalogComponent {
    catalogService = inject(CatalogService);
    viewMode = signal<'list' | 'create'>('list');
    generosInput = '';

    newItem: Content = {
        type: 'content',
        contentType: 'MOVIE',
        name: '',
        genres: [],
        premiered: '',
        awards: '',
        downloads: 0,
        rating: 0,
        mainCastId: '',
        castIds: []
    };

    save() {
        // Preparar objeto
        this.newItem.genres = this.generosInput.split(',').map(g => g.trim()).filter(g => g);
        // Añadir principal al reparto
        if (this.newItem.mainCastId) {
            this.newItem.castIds = [this.newItem.mainCastId];
        }

        this.catalogService.addContent(this.newItem).subscribe({
            next: () => {
                alert('Guardado en CouchDB');
                this.catalogService.refreshData();
                this.viewMode.set('list');
            },
            error: (err) => alert('Error al guardar: ' + err.message)
        });
    }

    deleteItem(item: Content) {
        if (!confirm(`¿Eliminar ${item.name}?`)) return;
        if (item._id && item._rev) {
            this.catalogService.deleteContent(item._id, item._rev).subscribe(() => {
                this.catalogService.refreshData();
            });
        }
    }
}
