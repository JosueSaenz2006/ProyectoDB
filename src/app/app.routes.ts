import { Routes } from '@angular/router';
import { SearchComponent } from './pages/search/search.component';
import { WatchlistComponent } from './pages/watchlist/watchlist.component';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: 'buscar', component: SearchComponent },
  { path: 'watchlist', component: WatchlistComponent },
  { path: 'catalogo', component: CatalogComponent },
  { path: 'reportes', component: ReportsComponent },
  { path: 'configuracion', component: SettingsComponent },
  { path: '', redirectTo: 'buscar', pathMatch: 'full' }
];