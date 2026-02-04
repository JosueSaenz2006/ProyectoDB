import { Injectable, inject } from '@angular/core';
import { CatalogService } from './catalog.service';
import { Observable, of, map } from 'rxjs';
import { ContentPopulated, Person } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private catalogService = inject(CatalogService);

  // 1. Contenidos por rango de fecha de estreno
  getByDateRange(start: string, end: string): Observable<ContentPopulated[]> {
    const contents = this.catalogService.contents();
    const filtered = contents.filter(c => {
      const date = c.premiered || '';
      return date >= start && date <= end;
    }).sort((a, b) => (b.premiered || '').localeCompare(a.premiered || ''));
    return of(filtered);
  }

  // 2. Top contenidos por descargas
  getTopDownloads(limit: number = 10): Observable<ContentPopulated[]> {
    const contents = this.catalogService.contents();
    const sorted = [...contents]
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, limit);
    return of(sorted);
  }

  // 3. Contenidos por actor
  getByActor(actorId: string): Observable<ContentPopulated[]> {
    const contents = this.catalogService.contents();
    const filtered = contents.filter(c =>
      c.mainCastId === actorId || c.castIds.includes(actorId)
    ).sort((a, b) => (b.premiered || '').localeCompare(a.premiered || ''));
    return of(filtered);
  }

  // 4. Contenidos por género
  getByGenre(genre: string): Observable<ContentPopulated[]> {
    const contents = this.catalogService.contents();
    const genreLower = genre.toLowerCase();
    const filtered = contents.filter(c =>
      c.genres.some(g => g.toLowerCase().includes(genreLower))
    ).sort((a, b) => (b.premiered || '').localeCompare(a.premiered || ''));
    return of(filtered);
  }

  // 5. Colaboraciones entre actores
  getCollaborators(actorId: string): Observable<{ name: string, count: number }[]> {
    const contents = this.catalogService.contents();
    const persons = this.catalogService.persons();

    // Encontrar contenidos donde participa el actor
    const actorContents = contents.filter(c =>
      c.mainCastId === actorId || c.castIds.includes(actorId)
    );

    // Contar colaboradores
    const collabMap = new Map<string, number>();
    actorContents.forEach(content => {
      const allCast = [content.mainCastId, ...content.castIds];
      allCast.forEach(castId => {
        if (castId !== actorId) {
          collabMap.set(castId, (collabMap.get(castId) || 0) + 1);
        }
      });
    });

    // Convertir a array con nombres
    const result = Array.from(collabMap.entries())
      .map(([id, count]) => {
        const person = persons.find(p => p._id === id);
        return { name: person?.fullName || id, count };
      })
      .sort((a, b) => b.count - a.count);

    return of(result);
  }

  // Utilidad: Listar todos los géneros únicos
  getAllGenres(): Observable<string[]> {
    const contents = this.catalogService.contents();
    const genres = new Set<string>();
    contents.forEach(c => c.genres.forEach(g => genres.add(g)));
    return of(Array.from(genres).sort());
  }

  // Utilidad: Listar todos los actores
  getAllActors(): Observable<Person[]> {
    return of(this.catalogService.persons());
  }

  // Estadísticas generales
  getStats(): Observable<{
    totalSeries: number;
    totalMovies: number;
    totalActors: number;
    totalGenres: number;
    avgRating: number;
  }> {
    const contents = this.catalogService.contents();
    const persons = this.catalogService.persons();
    const genres = new Set<string>();
    contents.forEach(c => c.genres.forEach(g => genres.add(g)));

    const ratings = contents.filter(c => c.rating).map(c => c.rating || 0);
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    return of({
      totalSeries: contents.filter(c => c.contentType === 'SERIE').length,
      totalMovies: contents.filter(c => c.contentType === 'MOVIE').length,
      totalActors: persons.length,
      totalGenres: genres.size,
      avgRating: Math.round(avgRating * 10) / 10
    });
  }
}
