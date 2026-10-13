import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { submitDialog } from '../shared/dialogs';
import { CategoriesService, Category, CategoryKind } from './categories.service';

export interface CategoryDialogData {
  /** La categoria da modificare; null per crearne una. */
  category: Category | null;
  kind: CategoryKind;
  /** Le categorie di primo livello dello stesso tipo, tra cui scegliere quella superiore. */
  parents: Category[];
}

/** Crea una categoria o, se ne riceve una, la modifica o la elimina. Il tipo si sceglie dalla colonna di partenza. */
@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      {{ data.category ? 'Modifica categoria' : 'Nuova categoria' }} di {{ data.kind === 'Income' ? 'entrata' : 'uscita' }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="60" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Sottocategoria di</mat-label>
          <mat-select formControlName="parentId">
            <mat-option [value]="null">Nessuna</mat-option>
            @for (parent of parents; track parent.id) {
              <mat-option [value]="parent.id">{{ parent.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.category) {
          <button matButton type="button" (click)="remove()">Elimina</button>
        }
        <span class="spacer"></span>
        <button matButton type="button" mat-dialog-close>Annulla</button>
        <button matButton="filled" type="submit" [disabled]="form.invalid">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CategoryDialog {
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CategoryDialog, boolean>>(MatDialogRef);
  private readonly categories = inject(CategoriesService);

  protected readonly parents = this.data.parents.filter((parent) => parent.id !== this.data.category?.id);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.category?.name ?? '', Validators.required],
    parentId: [this.data.category?.parentId ?? null],
  });

  protected readonly errors = signal<string[]>([]);

  protected save(): Promise<void> {
    const input = { ...this.form.getRawValue(), kind: this.data.kind };
    return submitDialog(this.ref, this.errors, () => this.categories.save(input, this.data.category?.id));
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.categories.remove(this.data.category!.id));
  }
}
