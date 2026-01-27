import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../../services/reports.service';
import { CatalogService } from '../../../services/catalog.service';
import { Content } from '../../../models/types';

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

    tabs = [
        { id: 'dates', label: 'Fechas' },
        { id: 'downloads', label: 'Top Descargas' },
        { id: 'actor', label: 'Por Actor' },
        { id: 'genre', label: 'Por Género' },
        { id: 'collab', label: 'Colaboraciones' },
    ];

    activeTab = signal('dates');
    reportResults = signal<Content[]>([]);
    collabResults = signal<{ name: string, count: number }[]>([]);

    // Inputs
    dateStart = '2000-01-01';
    dateEnd = '2025-01-01';
    selectedActorId = '';
    genreQuery = '';
    selectedCollabId = '';

    setTab(id: string) {
        this.activeTab.set(id);
        this.reportResults.set([]);
        this.collabResults.set([]);
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
        this.reportsService.getCollaborators(this.selectedCollabId).subscribe(res => this.collabResults.set(res));
    }
}
