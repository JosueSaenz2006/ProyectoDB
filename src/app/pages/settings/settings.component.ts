import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouchDbService } from '../../../services/couchdb.service';
import { StorageService } from '../../../services/storage.service';
import { CatalogService } from '../../../services/catalog.service';
import { WatchlistService } from '../../../services/watchlist.service';
import { CouchDbConfig } from '../../../models/types';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.css'
})
export class SettingsComponent {
    private couchService = inject(CouchDbService);
    private storageService = inject(StorageService);
    private catalogService = inject(CatalogService);
    private watchlistService = inject(WatchlistService);

    // Estado local del formulario
    config: CouchDbConfig = {
        host: 'http://127.0.0.1:5984',
        dbName: 'streaming_guide_db',
        username: '',
        password: ''
    };

    // Signals para UI
    isLoading = signal(false);
    isSyncing = signal(false);
    connectionStatus = signal('');
    connectionSuccess = signal(false);
    dbNotFound = signal(false);
    syncMessage = signal('');

    constructor() {
        // Intentar cargar config previa
        const saved = this.storageService.getItem<CouchDbConfig>('couchdb_config');
        if (saved) {
            this.config = saved;
        }
    }

    saveConfigLocally() {
        this.storageService.setItem('couchdb_config', this.config);
    }

    async testConnection() {
        this.isLoading.set(true);
        this.connectionStatus.set('');
        this.dbNotFound.set(false);
        this.saveConfigLocally();

        const result = await this.couchService.testConnection(this.config);

        this.isLoading.set(false);
        this.connectionSuccess.set(result.success);
        this.connectionStatus.set(result.message);

        if (!result.success && result.message.includes('Base de Datos no existe')) {
            this.dbNotFound.set(true);
        }
    }

    async createDb() {
        this.isLoading.set(true);
        const success = await this.couchService.createDatabase(this.config);
        this.isLoading.set(false);
        if (success) {
            this.testConnection(); // Re-test
        } else {
            this.connectionStatus.set('Error crítico creando la BD. Verifica permisos de administrador.');
        }
    }

    async syncUpload() {
        if (!confirm('¿Estás seguro de subir tus datos? Esto actualizará el respaldo en CouchDB.')) return;

        this.isSyncing.set(true);
        this.syncMessage.set('Subiendo datos a CouchDB...');

        const catalogo = this.catalogService.contents();
        const watchlist = this.watchlistService.watchlist();

        const success = await this.couchService.uploadBackup(this.config, catalogo, watchlist);

        this.isSyncing.set(false);
        if (success) {
            this.syncMessage.set('✅ Respaldo subido correctamente.');
            setTimeout(() => this.syncMessage.set(''), 3000);
        } else {
            this.syncMessage.set('❌ Error al subir. Revisa la consola.');
        }
    }

    async syncDownload() {
        if (!confirm('ATENCIÓN: Esto borrará tus datos locales actuales y los reemplazará con los de CouchDB. ¿Continuar?')) return;

        this.isSyncing.set(true);
        this.syncMessage.set('Descargando datos de CouchDB...');

        const data = await this.couchService.downloadBackup(this.config);

        this.isSyncing.set(false);
        if (data) {
            this.storageService.setItem('mi_catalogo', data.catalogo);
            this.storageService.setItem('mi_watchlist', data.watchlist);

            this.syncMessage.set('✅ Datos restaurados. Recargando aplicación...');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            this.syncMessage.set('❌ Error al descargar o no existe respaldo remoto.');
        }
    }
}
