import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Icon } from '../layout/icon';
import { formDialog } from '../shared/dialogs';
import { CategoriesService, Category, CategoryKind, categoryTree } from './categories.service';
import { CategoryDialog, CategoryDialogData } from './category-dialog';

@Component({
  selector: 'app-categories',
  imports: [Icon, MatButtonModule, MatCardModule],
  template: `
    <main class="page">
      <h1>Categorie</h1>

      <div class="columns">
        @for (column of columns(); track column.kind) {
          <mat-card appearance="outlined">
            <div class="row head">
              <span>{{ column.label }}</span>
              <button matIconButton type="button" (click)="open(column.kind, null)" [attr.aria-label]="'Aggiungi a ' + column.label">
                <app-icon name="add" />
              </button>
            </div>
            @for (node of column.nodes; track node.category.id) {
              <button type="button" class="row" (click)="open(column.kind, node.category)">{{ node.category.name }}</button>
              @for (child of node.children; track child.id) {
                <button type="button" class="row child" (click)="open(column.kind, child)">{{ child.name }}</button>
              }
            }
          </mat-card>
        }
      </div>
    </main>
  `,
  styles: `
    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .child {
      padding-left: 2.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Categories {
  private readonly service = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);

  private readonly categories = signal<Category[]>([]);

  protected readonly columns = computed(() =>
    (['Expense', 'Income'] as const).map((kind) => ({
      kind,
      label: kind === 'Expense' ? 'Uscite' : 'Entrate',
      nodes: categoryTree(this.categories(), kind),
    })),
  );

  constructor() {
    void this.load();
  }

  protected async open(kind: CategoryKind, category: Category | null): Promise<void> {
    const parents = categoryTree(this.categories(), kind).map((node) => node.category);
    const data: CategoryDialogData = { category, kind, parents };
    if (await firstValueFrom(this.dialog.open(CategoryDialog, formDialog(data)).afterClosed())) await this.load();
  }

  private async load(): Promise<void> {
    this.categories.set(await this.service.list());
  }
}
