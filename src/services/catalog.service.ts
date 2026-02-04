import { Injectable, inject, signal } from '@angular/core';
import { CouchDbService, TargetDatabase } from './couchdb.service';
import { TvMazeService, TvMazeCastMember } from './tvmaze.service';
import { Content, Person, ContentPopulated, GenderType } from '../models/types';
import { forkJoin, map, switchMap, of, Observable, firstValueFrom, catchError } from 'rxjs';

// Tipo para descripciones (sinopsis)
export interface Description {
  _id?: string;
  _rev?: string;
  type: 'description';
  contentId: string;  // Referencia al content (ej: "title:breaking_bad")
  summaryEn: string;  // Sinopsis en inglés
  summaryEs: string;  // Sinopsis en español
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private db = inject(CouchDbService);
  private tvmaze = inject(TvMazeService);

  // Signals para estado local (reactividad en UI)
  contents = signal<ContentPopulated[]>([]);
  persons = signal<Person[]>([]);

  constructor() {
    this.refreshData();
  }

  refreshData() {
    // Cargar personas de actores_db y contenidos de series_db + peliculas_db
    forkJoin({
      series: this.db.listByTypeIn<Content>('series'),
      peliculas: this.db.listByTypeIn<Content>('peliculas'),
      personas: this.db.listByTypeIn<Person>('actores')
    }).pipe(
      catchError(err => {
        console.warn('Error cargando datos, algunas BDs pueden no existir:', err);
        return of({ series: { docs: [] }, peliculas: { docs: [] }, personas: { docs: [] } });
      })
    ).subscribe(({ series, peliculas, personas }) => {
      const allPersons = personas.docs || [];
      this.persons.set(allPersons);

      // Combinar series y películas
      const allContent = [...(series.docs || []), ...(peliculas.docs || [])];
      const populated = allContent.map(content => this.populateContent(content, allPersons));
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

  // Genera un ID legible basado en el nombre: "title:the_boys"
  private generateContentId(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    return `title:${slug}`;
  }

  // Genera un ID legible para personas: "person:nombre_apellido"
  private generatePersonId(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    return `person:${slug}`;
  }

  // Genera un ID para descripciones
  private generateDescriptionId(contentId: string): string {
    return `desc:${contentId.replace('title:', '')}`;
  }

  // === VERIFICACIÓN DE EXISTENCIA ===

  // Verifica si un contenido ya existe (busca en series_db y peliculas_db)
  async contentExists(id: string, type: 'SERIE' | 'MOVIE' = 'SERIE'): Promise<{ exists: boolean; doc?: Content }> {
    const targetDb: TargetDatabase = type === 'SERIE' ? 'series' : 'peliculas';
    try {
      const doc = await firstValueFrom(
        this.db.getFrom<Content>(targetDb, id).pipe(
          catchError(() => of(null))
        )
      );
      return { exists: !!doc, doc: doc || undefined };
    } catch {
      return { exists: false };
    }
  }

  // Verifica si una persona ya existe en actores_db
  async personExists(id: string): Promise<{ exists: boolean; doc?: Person }> {
    try {
      const doc = await firstValueFrom(
        this.db.getFrom<Person>('actores', id).pipe(
          catchError(() => of(null))
        )
      );
      return { exists: !!doc, doc: doc || undefined };
    } catch {
      return { exists: false };
    }
  }

  // === PERSONAS (actores_db) ===
  addPerson(person: Person): Observable<any> {
    return this.db.createIn('actores', person);
  }

  // === CONTENIDOS (series_db o peliculas_db) ===
  addContent(content: Content): Observable<any> {
    const targetDb: TargetDatabase = content.contentType === 'SERIE' ? 'series' : 'peliculas';
    content.castIds = [...new Set(content.castIds)];
    return this.db.createIn(targetDb, content);
  }

  deleteContent(id: string, rev: string, type: 'SERIE' | 'MOVIE' = 'SERIE'): Observable<any> {
    const targetDb: TargetDatabase = type === 'SERIE' ? 'series' : 'peliculas';
    return this.db.deleteFrom(targetDb, id, rev);
  }

  // === DESCRIPCIONES (descripcion_db) ===
  async saveDescription(contentId: string, summaryEn: string, summaryEs: string): Promise<boolean> {
    const descId = this.generateDescriptionId(contentId);

    try {
      // Verificar si ya existe
      const existing = await firstValueFrom(
        this.db.getFrom<Description>('descripcion', descId).pipe(
          catchError(() => of(null))
        )
      );

      if (existing) {
        // Actualizar descripción existente
        const updatedDesc: Description = {
          ...existing,
          summaryEn: summaryEn || existing.summaryEn,
          summaryEs: summaryEs || existing.summaryEs
        };
        await firstValueFrom(this.db.updateIn('descripcion', updatedDesc as any));
        console.log('📝 Descripción actualizada en descripcion_db');
        return true;
      } else {
        // Crear nueva descripción
        const desc: Description = {
          _id: descId,
          type: 'description',
          contentId: contentId,
          summaryEn: summaryEn,
          summaryEs: summaryEs
        };
        await firstValueFrom(this.db.createIn('descripcion', desc as any));
        console.log('📝 Descripción creada en descripcion_db');
        return true;
      }
    } catch (e) {
      console.error('Error guardando descripción:', e);
      return false;
    }
  }

  async getDescription(contentId: string): Promise<Description | null> {
    const descId = this.generateDescriptionId(contentId);
    try {
      return await firstValueFrom(
        this.db.getFrom<Description>('descripcion', descId).pipe(
          catchError(() => of(null))
        )
      );
    } catch {
      return null;
    }
  }

  // === IMPORTACIÓN DESDE TVMAZE ===
  async importFromTvMaze(
    content: Partial<Content>,
    tvMazeShowId?: number
  ): Promise<{ success: boolean; message: string; isNew: boolean }> {
    const contentName = content.name || 'Sin nombre';
    const contentId = this.generateContentId(contentName);
    const contentType = content.contentType || 'SERIE';
    const targetDb: TargetDatabase = contentType === 'SERIE' ? 'series' : 'peliculas';

    // Verificar si ya existe
    const { exists, doc: existingDoc } = await this.contentExists(contentId, contentType);

    if (exists && existingDoc) {
      // Si existe pero no tiene video y el nuevo sí, actualizar solo el video
      if (!existingDoc.video && content.video) {
        const updatedDoc = {
          ...existingDoc,
          video: content.video
        };
        try {
          await firstValueFrom(this.db.updateIn(targetDb, updatedDoc));
          this.refreshData();
          return {
            success: true,
            message: `"${contentName}" ya existe. Se actualizó el video.`,
            isNew: false
          };
        } catch {
          return {
            success: false,
            message: `"${contentName}" ya existe pero no se pudo actualizar.`,
            isNew: false
          };
        }
      }

      console.log(`⚠ "${contentName}" ya existe en ${targetDb}, no se guardó duplicado.`);
      return {
        success: true,
        message: `"${contentName}" ya existe en la base de datos.`,
        isNew: false
      };
    }

    // === FETCH Y CREAR CAST REAL DESDE TVMAZE ===
    let mainCastId = '';
    let castIds: string[] = [];

    if (tvMazeShowId) {
      try {
        const castMembers = await firstValueFrom(this.tvmaze.getCast(tvMazeShowId));
        const limitedCast = castMembers.slice(0, 10);

        for (let i = 0; i < limitedCast.length; i++) {
          const member = limitedCast[i];
          const personId = this.generatePersonId(member.person.name);

          // Verificar si ya existe en actores_db
          const { exists: personExists } = await this.personExists(personId);

          if (!personExists) {
            const gender: GenderType =
              member.person.gender?.toLowerCase() === 'female' ? 'MUJER' : 'HOMBRE';

            const newPerson: Person = {
              _id: personId,
              type: 'person',
              fullName: member.person.name,
              country: member.person.country?.name || 'Desconocido',
              birthDate: member.person.birthday || '1900-01-01',
              gender: gender
            };

            try {
              await firstValueFrom(this.db.createIn('actores', newPerson));
              console.log(`✓ Actor guardado en actores_db: ${member.person.name}`);
            } catch (e) {
              console.warn(`⚠ No se pudo crear actor: ${member.person.name}`, e);
            }
          }

          castIds.push(personId);
          if (i === 0) {
            mainCastId = personId;
          }
        }
      } catch (e) {
        console.warn('⚠ No se pudo obtener cast de TVMaze:', e);
      }
    }

    // Si no hay cast, crear actor fallback
    if (!mainCastId) {
      const fallbackId = 'person:actor_desconocido';
      const { exists: fallbackExists } = await this.personExists(fallbackId);

      if (!fallbackExists) {
        const dummy: Person = {
          _id: fallbackId,
          type: 'person',
          fullName: 'Actor Desconocido',
          country: 'N/A',
          birthDate: '2000-01-01',
          gender: 'HOMBRE'
        };
        try {
          await firstValueFrom(this.db.createIn('actores', dummy));
        } catch { }
      }

      mainCastId = fallbackId;
      castIds = [fallbackId];
    }

    // Crear el contenido en la BD correspondiente
    const newContent: Content = {
      _id: contentId,
      type: 'content',
      contentType: contentType,
      name: contentName,
      genres: content.genres || [],
      premiered: content.premiered || '2000-01-01',
      awards: [],
      downloads: 0,
      rating: content.rating || 0,
      mainCastId: mainCastId,
      castIds: [...new Set(castIds)],
      seasons: content.seasons || [],
      video: content.video,
      image: content.image
    };

    try {
      await firstValueFrom(this.db.createIn(targetDb, newContent));

      // Guardar descripción si existe
      const summaryEn = (content as any).summary || '';
      const summaryEs = (content as any).summaryEs || '';
      if (summaryEn || summaryEs) {
        await this.saveDescription(contentId, summaryEn, summaryEs);
        console.log(`✓ Descripción guardada en descripcion_db`);
      }

      this.refreshData();
      const castCount = castIds.length;
      console.log(`✓ "${contentName}" guardada en ${targetDb} con ${castCount} actores`);
      return {
        success: true,
        message: `"${contentName}" guardada en ${targetDb} con ${castCount} actores.`,
        isNew: true
      };
    } catch (e) {
      console.error(`Error guardando en ${targetDb}:`, e);
      return {
        success: false,
        message: `Error al guardar "${contentName}".`,
        isNew: false
      };
    }
  }

  // === ACTUALIZAR PERSONA ===

  /**
   * Actualiza la imagen de un actor/persona
   */
  async updatePersonImage(personId: string, imageUrl: string): Promise<boolean> {
    try {
      // Obtener la persona actual
      const persons = this.persons();
      const person = persons.find(p => p._id === personId);

      if (!person) {
        console.error('Persona no encontrada:', personId);
        return false;
      }

      // Actualizar con la nueva imagen
      const updatedPerson = { ...person, image: imageUrl };

      // Guardar en CouchDB
      await firstValueFrom(this.db.updateIn('actores', updatedPerson));

      // Actualizar signal local
      const newPersons = persons.map(p =>
        p._id === personId ? updatedPerson : p
      );
      this.persons.set(newPersons);

      console.log(`✓ Imagen actualizada para ${person.fullName}`);
      return true;
    } catch (error) {
      console.error('Error actualizando imagen de persona:', error);
      return false;
    }
  }

  /**
   * Actualiza la biografía de un actor/persona
   */
  async updatePersonBio(personId: string, bio: string): Promise<boolean> {
    try {
      const persons = this.persons();
      const person = persons.find(p => p._id === personId);

      if (!person) return false;

      const updatedPerson = { ...person, bio };
      await firstValueFrom(this.db.updateIn('actores', updatedPerson));

      const newPersons = persons.map(p =>
        p._id === personId ? updatedPerson : p
      );
      this.persons.set(newPersons);

      return true;
    } catch (error) {
      console.error('Error actualizando bio de persona:', error);
      return false;
    }
  }

  /**
   * Actualiza un contenido existente (serie o película)
   */
  async updateContent(data: {
    _id: string;
    name: string;
    genres: string[];
    premiered: string;
    awards: string[];
    downloads: number;
    rating: number | null;
    contentType: 'MOVIE' | 'SERIE';
    mainCastId: string;
    castIds: string[];
    seasons?: { seasonNumber: number; episodeCount: number }[];
    videoUrl?: string;
    image?: string;
    summaryEs?: string;
  }): Promise<boolean> {
    try {
      // Buscar contenido existente
      const contents = this.contents();
      const existing = contents.find(c => c._id === data._id);

      if (!existing) {
        console.error('Contenido no encontrado:', data._id);
        return false;
      }

      // Determinar base de datos
      const targetDb = data.contentType === 'SERIE' ? 'series' : 'peliculas';

      // Construir objeto actualizado
      const updatedContent: Content = {
        _id: existing._id,
        _rev: existing._rev,
        type: 'content',
        contentType: data.contentType,
        name: data.name,
        genres: data.genres,
        premiered: data.premiered,
        awards: data.awards,
        downloads: data.downloads,
        rating: data.rating,
        mainCastId: data.mainCastId,
        castIds: data.castIds,
        seasons: data.seasons,
        video: data.videoUrl ? { url: data.videoUrl } : existing.video,
        image: data.image || existing.image
      };

      // Guardar en CouchDB
      await firstValueFrom(this.db.updateIn(targetDb as any, updatedContent));

      // Guardar descripción si existe
      if (data.summaryEs) {
        await this.saveDescription(data._id, '', data.summaryEs);
      }

      console.log(`✓ Contenido actualizado: ${data.name}`);
      return true;
    } catch (error) {
      console.error('Error actualizando contenido:', error);
      return false;
    }
  }
}

