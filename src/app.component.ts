import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <span class="text-xl font-bold text-indigo-600">TV Manager</span>
              </div>
              <div class="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                <a routerLink="/buscar" routerLinkActive="border-indigo-500 text-gray-900" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">
                  Buscar
                </a>
                <a routerLink="/watchlist" routerLinkActive="border-indigo-500 text-gray-900" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">
                  Watchlist
                </a>
                <a routerLink="/catalogo" routerLinkActive="border-indigo-500 text-gray-900" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">
                  Catálogo
                </a>
                <a routerLink="/reportes" routerLinkActive="border-indigo-500 text-gray-900" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">
                  Reportes
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main class="py-6">
        <router-outlet />
      </main>
    </div>
  `
})
export class AppComponent {}