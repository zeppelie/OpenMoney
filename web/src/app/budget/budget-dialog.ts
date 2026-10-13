import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { submitDialog } from '../shared/dialogs';
import { BudgetLine, BudgetService } from './budget.service';

/** Imposta, cambia o toglie il budget mensile di una categoria. */
@Component({
  selector: 'app-budget-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Budget di {{ line.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Budget mensile (€)</mat-label>
          <input matInput type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="amount" />
          <mat-hint>Vale per ogni mese e comprende le sottocategorie.</mat-hint>
        </mat-form-field>
        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (line.budget !== null) {
          <button matButton type="button" (click)="remove()">Togli budget</button>
        }
        <span class="spacer"></span>
        <button matButton type="button" mat-dialog-close>Annulla</button>
        <button matButton="filled" type="submit" [disabled]="form.invalid">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BudgetDialog {
  protected readonly line = inject<BudgetLine>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<BudgetDialog, boolean>>(MatDialogRef);
  private readonly budgets = inject(BudgetService);

  protected readonly form = inject(FormBuilder).group({
    amount: [this.line.budget, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly errors = signal<string[]>([]);

  protected save(): Promise<void> {
    // Il pulsante Salva è spento finché l'importo manca.
    const amount = this.form.getRawValue().amount!;
    return submitDialog(this.ref, this.errors, () => this.budgets.set(this.line.categoryId, amount));
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.budgets.remove(this.line.categoryId));
  }
}
