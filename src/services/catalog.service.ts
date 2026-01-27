import { Injectable, inject, signal } from '@angular/core';
import { CouchDbService } from './couchdb.service';
import { Content, Person, ContentPopulated } from '../models/types';
import { forkJoin, map, switchMap, of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private db = inject(CouchDbService);

  // Signals para estado local (reactividad en UI)
  contents = signal<ContentPopulated[]>([]);
  persons = signal<Person[]>([]);

  constructor() {
    this.refreshData();
  }

  refreshData() {
    // Cargar personas y contenidos en paralelo
    forkJoin({
      c: this.db.listByType<Content>('content'),
      p: this.db.listByType<Person>('person')
    }).subscribe(({ c, p }) => {
      this.persons.set(p.docs);
      
      // "Join" manual en cliente para mostrar nombres
      const populated = c.docs.map(content => this.populateContent(content, p.docs));
      this.contents.set(populated);
    });
  }

  // Helper para unir datos
  private populateContent(content: Content, allPersons: Person[]): ContentPopulated {
    const main = allPersons.find(p => p._id === content.mainCastId);
    const cast = content.castIds.map(id => allPersons.find(p => p._id === id)).filter((p): p is Person => !!p);
    
    return {
      ...content,
      actorPrincipal: main,
      reparto: cast
    };
  }

  // === PERSONAS ===
  addPerson(person: Person): Observable<any> {
    return this.db.create(person);
  }

  // === CONTENIDOS ===
  addContent(content: Content): Observable<any> {
    // Si no tiene _id, CouchDB lo crea.
    // Asegurar castIds únicos
    content.castIds = [...new Set(content.castIds)];
    return this.db.create(content);
  }

  deleteContent(id: string, rev: string): Observable<any> {
    return this.db.delete(id, rev);
  }

  // Helper para SearchComponent (Importación)
  // Genera un ID automático o usa UUID
  async importFromTvMaze(content: Partial<Content>): Promise<void> {
    // Verificar si ya existe el actor "Desconocido" o crearlo
    // Para simplificar, asumimos que se asigna a un actor dummy si no existe
    // En producción esto requeriría más lógica.
    
    // Por simplicidad, asignamos al primer actor disponible en BD o requerimos crear uno.
    const currentPersons = this.persons();
    let defaultActorId = currentPersons[0]?._id;

    if (!defaultActorId) {
       // Crear actor dummy
       const dummy: Person = { 
         type: 'person', 
         fullName: 'Actor Desconocido', 
         country: 'N/A', 
         birthDate: '2000-01-01', 
         gender: 'HOMBRE' 
       };
       const res = await this.db.create(dummy).toPromise(); // Deprecated toPromise but simple here
       defaultActorId = res!.id;
       this.refreshData();
    }

    const newContent: Content = {
      type: 'content',
      contentType: content.contentType || 'SERIE',
      name: content.name || 'Sin nombre',
      genres: content.genres || [],
      premiered: content.premiered || '2000-01-01',
      awards: '',
      downloads: 0,
      rating: content.rating || 0,
      mainCastId: defaultActorId,
      castIds: [defaultActorId],
      seasons: content.seasons || []
    };

    this.db.create(newContent).subscribe(() => {
      this.refreshData();
    });
  }
}
