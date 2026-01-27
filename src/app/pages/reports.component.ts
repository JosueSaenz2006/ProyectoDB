import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../services/reports.service';
import { CatalogService } from '../../services/catalog.service'; // Para cargar lista de actores en selects
import { Content } from '../../models/types';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">Reportes CouchDB</h1>

      <div class="flex flex-wrap gap-2 mb-8">
        @for (tab of tabs; track tab.id) {
          <button (click)="setTab(tab.id)" class="px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm"
            [class.bg-blue-600]="activeTab() === tab.id" [class.text-white]="activeTab() === tab.id"
            [class.bg-white]="activeTab() !== tab.id">
            {{ tab.label }}
          </button>
        }
      </div>

      <div class="bg-white p-8 rounded-2xl shadow-xl min-h-[400px] border border-gray-100">
        
        <!-- 1. Fechas (Mango) -->
        @if (activeTab() === 'dates') {
          <div class="max-w-4xl">
            <h2 class="text-2xl font-bold mb-4">Estrenadas en un periodo (Mango Query)</h2>
            <div class="flex gap-4 mb-4">
              <input type="date" [(ngModel)]="dateStart" class="border p-2 rounded">
              <input type="date" [(ngModel)]="dateEnd" class="border p-2 rounded">
              <button (click)="runDateReport()" class="bg-blue-600 text-white px-4 rounded">Ejecutar</button>
            </div>
            
            <table class="w-full text-left bg-gray-50 rounded">
              <thead><tr><th class="p-4">Nombre</th><th class="p-4">Estreno</th></tr></thead>
              <tbody>
                @for (item of reportResults(); track item._id) {
                  <tr class="border-t">
                    <td class="p-4 font-bold">{{ item.name }}</td>
                    <td class="p-4">{{ item.premiered }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- 2. Descargas (View) -->
        @if (activeTab() === 'downloads') {
          <h2 class="text-2xl font-bold mb-4">Top 10 Descargas (View MapReduce)</h2>
          <div class="space-y-3">
            @for (item of reportResults(); track item._id; let idx = $index) {
              <div class="flex items-center p-4 bg-gray-50 rounded border">
                <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mr-4">{{ idx + 1 }}</div>
                <div class="flex-1 font-bold">{{ item.name }}</div>
                <div class="text-right font-mono">{{ item.downloads | number }} dls</div>
              </div>
            }
          </div>
        }

        <!-- 3. Por Actor (View) -->
        @if (activeTab() === 'actor') {
          <h2 class="text-2xl font-bold mb-4">Por Actor (View)</h2>
          <select [(ngModel)]="selectedActorId" (change)="runActorReport()" class="border p-2 rounded w-full mb-4">
             <option value="">Selecciona Actor</option>
             @for (p of catalogService.persons(); track p._id) {
               <option [value]="p._id">{{ p.fullName }}</option>
             }
          </select>
          <div class="grid gap-2">
             @for (item of reportResults(); track item._id) {
               <div class="p-3 bg-gray-50 border rounded">{{ item.name }} ({{ item.contentType }})</div>
             }
          </div>
        }

        <!-- 4. Por Género (View) -->
        @if (activeTab() === 'genre') {
           <h2 class="text-2xl font-bold mb-4">Por Género (View)</h2>
           <div class="flex gap-2 mb-4">
             <input [(ngModel)]="genreQuery" placeholder="Ej: Drama" class="border p-2 rounded">
             <button (click)="runGenreReport()" class="bg-blue-600 text-white px-4 rounded">Buscar</button>
           </div>
           <div class="grid gap-2">
             @for (item of reportResults(); track item._id) {
               <div class="p-3 bg-gray-50 border rounded">{{ item.name }}</div>
             }
          </div>
        }

        <!-- 5. Colaboraciones (MapReduce) -->
        @if (activeTab() === 'collab') {
          <h2 class="text-2xl font-bold mb-4">Colaboraciones (Complex MapReduce)</h2>
          <p class="mb-4 text-sm text-gray-500">Muestra actores que han trabajado con el seleccionado.</p>
          <select [(ngModel)]="selectedCollabId" (change)="runCollabReport()" class="border p-2 rounded w-full mb-4">
             <option value="">Selecciona Actor Base</option>
             @for (p of catalogService.persons(); track p._id) {
               <option [value]="p._id">{{ p.fullName }}</option>
             }
          </select>
          
          <div class="flex flex-wrap gap-4">
            @for (c of collabResults(); track c.name) {
              <div class="bg-indigo-50 border border-indigo-200 p-4 rounded-lg text-center">
                <div class="text-indigo-900 font-bold">{{ c.name }}</div>
                <div class="text-xs text-indigo-500">{{ c.count }} proyectos juntos</div>
              </div>
            }
          </div>
        }

      </div>
    </div>
  `
})
export class ReportsComponent {
  reportsService = inject(ReportsService);
  catalogService = inject(CatalogService); // To list persons
  
  tabs = [
    { id: 'dates', label: 'Fechas' },
    { id: 'downloads', label: 'Top Descargas' },
    { id: 'actor', label: 'Por Actor' },
    { id: 'genre', label: 'Por Género' },
    { id: 'collab', label: 'Colaboraciones' },
  ];
  
  activeTab = signal('dates');
  reportResults = signal<Content[]>([]);
  collabResults = signal<{name:string, count:number}[]>([]);

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
    if(!this.selectedActorId) return;
    this.reportsService.getByActor(this.selectedActorId).subscribe(res => this.reportResults.set(res));
  }

  runGenreReport() {
    this.reportsService.getByGenre(this.genreQuery).subscribe(res => this.reportResults.set(res));
  }

  runCollabReport() {
    if(!this.selectedCollabId) return;
    this.reportsService.getCollaborators(this.selectedCollabId).subscribe(res => this.collabResults.set(res));
  }
}
