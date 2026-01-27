
import { Injectable, inject } from '@angular/core';
import { CouchDbService } from './couchdb.service';
import { Observable, map, forkJoin, switchMap } from 'rxjs';
import { Content, Person } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private db = inject(CouchDbService);
  private DESIGN_DOC = 'streaming';

  // 1. Estrenadas en periodo (Mango Query)
  getByDateRange(start: string, end: string): Observable<Content[]> {
    const selector = {
      type: 'content',
      premiered: {
        '$gte': start,
        '$lte': end
      }
    };
    // Ordenar por fecha (requiere índice)
    return this.db.find<Content>(selector, [{ 'premiered': 'asc' }]).pipe(
      map(res => res.docs)
    );
  }

  // 2. Mayor Descarga (View: by_downloads)
  getTopDownloads(limit: number = 10): Observable<Content[]> {
    // descending=true para traer los mayores primero
    return this.db.view<{ rows: { id: string }[] }>(this.DESIGN_DOC, 'by_downloads', { 
      descending: true, 
      limit: limit, 
      include_docs: true 
    }).pipe(
      map((res: any) => res.rows.map((r: any) => r.doc))
    );
  }

  // 3. Por Actor (View: by_actor)
  getByActor(actorId: string): Observable<Content[]> {
    return this.db.view<{ rows: { id: string }[] }>(this.DESIGN_DOC, 'by_actor', {
      key: actorId,
      include_docs: true
    }).pipe(
      map((res: any) => res.rows.map((r: any) => r.doc))
    );
  }

  // 4. Por Género (Mango Query o View by_genre)
  getByGenre(genre: string): Observable<Content[]> {
    // Usamos View para variar
    return this.db.view<{ rows: { id: string }[] }>(this.DESIGN_DOC, 'by_genre', {
      key: genre,
      include_docs: true
    }).pipe(
      map((res: any) => res.rows.map((r: any) => r.doc))
    );
  }

  // 5. Colaboraciones (View: collaborations [MapReduce])
  getCollaborators(actorId: string): Observable<{ name: string, count: number }[]> {
    // startkey = [ID, ""] 
    // endkey = [ID, {}] (objeto vacío es el último valor posible en sort de CouchDB)
    // group=true para que agrupe por la key exacta [A, B]
    return this.db.view<any>(this.DESIGN_DOC, 'collaborations', {
      startkey: [actorId, ""],
      endkey: [actorId, {}],
      group: true
    }).pipe(
      switchMap((res: any) => {
        // res.rows = [{ key: [actorId, collabId], value: count }, ...]
        if (res.rows.length === 0) return [[]];

        // Necesitamos obtener los nombres de los colaboradores
        const collabIds = res.rows.map((r: any) => r.key[1]);
        const counts = res.rows.map((r: any) => r.value);

        // Fetch de personas para resolver nombres (bulk get sería mejor, pero hacemos loop simple o listByType)
        // Optimizamos: traer todas las personas y filtrar (ya que son pocas en el seed)
        // En prod: usar _all_docs con keys=[...]
        return this.db.listByType<Person>('person').pipe(
          map(pRes => {
            return collabIds.map((id: string, idx: number) => {
              const person = pRes.docs.find(p => p._id === id);
              return {
                name: person ? person.fullName : 'Desconocido',
                count: counts[idx]
              };
            });
          })
        );
      })
    );
  }

  // Utilidad: Listar todos los géneros (usando la vista y reduce=false o parseando)
  getAllGenres(): Observable<string[]> {
    return this.db.view<any>(this.DESIGN_DOC, 'by_genre', { reduce: false }).pipe(
        map((res: any) => {
            const genres = new Set<string>();
            res.rows.forEach((r: any) => genres.add(r.key));
            return Array.from(genres).sort();
        })
    );
  }
}
