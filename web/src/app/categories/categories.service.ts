import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type CategoryKind = 'Income' | 'Expense';

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  /** Categoria superiore, se questa è una sottocategoria. */
  parentId: string | null;
}

export interface Category extends CategoryInput {
  id: string;
}

/** Una categoria di primo livello con le sue sottocategorie. */
export interface CategoryNode {
  category: Category;
  children: Category[];
}

/** Le categorie di un tipo come albero a due livelli (il server le dà già in ordine alfabetico). */
export function categoryTree(categories: Category[], kind: CategoryKind): CategoryNode[] {
  const ofKind = categories.filter((category) => category.kind === kind);
  return ofKind
    .filter((category) => !category.parentId)
    .map((category) => ({ category, children: ofKind.filter((child) => child.parentId === category.id) }));
}

/** Nome completo di ogni categoria per id: "Casa › Affitto" per le sottocategorie. */
export function categoryLabels(categories: Category[]): Map<string, string> {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return new Map(
    categories.map((category) => [
      category.id,
      category.parentId ? `${names.get(category.parentId)} › ${category.name}` : category.name,
    ]),
  );
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);

  list(): Promise<Category[]> {
    return firstValueFrom(this.http.get<Category[]>('/api/categories'));
  }

  /** Con `id` modifica la categoria, senza ne crea una. */
  save(input: CategoryInput, id?: string): Promise<unknown> {
    return firstValueFrom(
      id ? this.http.put(`/api/categories/${id}`, input) : this.http.post('/api/categories', input),
    );
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/categories/${id}`));
  }
}
