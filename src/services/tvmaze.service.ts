import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { TvMazeResult } from '../models/types';

// Cast member from TVMaze API
export interface TvMazeCastMember {
  person: {
    id: number;
    name: string;
    country?: { name: string } | null;
    birthday?: string | null;
    gender?: string | null;
  };
  character: {
    name: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TvMazeService {
  private http: HttpClient = inject(HttpClient);
  private readonly BASE_URL = 'https://api.tvmaze.com';

  searchShows(query: string): Observable<TvMazeResult[]> {
    if (!query.trim()) return of([]);
    return this.http.get<TvMazeResult[]>(`${this.BASE_URL}/search/shows?q=${query}`)
      .pipe(
        catchError(err => {
          console.error('Error fetching TVMaze', err);
          return of([]);
        })
      );
  }

  // Obtener cast real de un show desde TVMaze
  getCast(showId: number): Observable<TvMazeCastMember[]> {
    return this.http.get<TvMazeCastMember[]>(`${this.BASE_URL}/shows/${showId}/cast`)
      .pipe(
        catchError(err => {
          console.error('Error fetching cast from TVMaze:', err);
          return of([]);
        })
      );
  }
}
