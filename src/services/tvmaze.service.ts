import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { TvMazeResult } from '../models/types';

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
}