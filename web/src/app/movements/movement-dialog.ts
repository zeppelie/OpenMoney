import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Account } from '../accounts/accounts.service';
import { Category, categoryTree } from '../categories/categories.service';
import { submitDialog } from '../shared/dialogs';
import { Movement, MovementKind, MovementsService } from './movements.service';

export interface MovementDialogData {
  /** Il movimento da modificare; null per crearne uno. */
  movement: Movement | null;
  /** Data proposta per un movimento nuovo (ISO aaaa-mm-gg). */
  date: string;
  accounts: Account[];
  categories: Category[];
}

/** Inserisce un'entrata, un'uscita o un trasferimento; se riceve un movimento lo modifica o lo elimina. */
@Component({
  selector: 'app-movement-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.movement ? 'Modifica movimento' : 'Nuovo movimento' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-button-toggle-group formControlName="kind" aria-label="Tipo di movimento" hideSingleSelectionIndicator>
          <mat-button-toggle value="Expense">Uscita</mat-button-toggle>
          <mat-button-toggle value="Income">Entrata</mat-button-toggle>
          <mat-button-toggle value="Transfer">Trasferimento</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Data</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Importo (€)</mat-label>
          <input matInput type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="amount" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ kind() === 'Transfer' ? 'Dal conto' : 'Conto' }}</mat-label>
          <mat-select formControlName="accountId">
            @for (account of data.accounts; track account.id) {
              <mat-option [value]="account.id">{{ account.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (kind() === 'Transfer') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Al conto</mat-label>
            <mat-select formControlName="toAccountId">
              @for (account of data.accounts; track account.id) {
                <mat-option [value]="account.id">{{ account.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="categoryId">
              @for (node of categories(); track node.category.id) {
                <mat-option [value]="node.category.id">{{ node.category.name }}</mat-option>
                @for (child of node.children; track child.id) {
                  <mat-option class="child" [value]="child.id">{{ node.category.name }} › {{ child.name }}</mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nota</mat-label>
          <input matInput formControlName="note" maxlength="200" />
        </mat-form-field>

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.movement) {
          <button matButton type="button" (click)="remove()">Elimina</button>
        }
        <span class="spacer"></span>
        <button matButton type="button" mat-dialog-close>Annulla</button>
        <button matButton="filled" type="submit" [disabled]="form.invalid">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MovementDialog {
  protected readonly data = inject<MovementDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<MovementDialog, boolean>>(MatDialogRef);
  private readonly movements = inject(MovementsService);

  protected readonly form = inject(FormBuilder).group({
    kind: [this.data.movement?.kind ?? ('Expense' as MovementKind), Validators.required],
    date: [this.data.movement?.date ?? this.data.date, Validators.required],
    amount: [this.data.movement?.amount ?? null, [Validators.required, Validators.min(0.01)]],
    accountId: [this.data.movement?.accountId ?? this.data.accounts[0]?.id ?? null, Validators.required],
    toAccountId: [this.data.movement?.toAccountId ?? null],
    categoryId: [this.data.movement?.categoryId ?? null],
    note: [this.data.movement?.note ?? null],
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, { initialValue: this.form.controls.kind.value });

  /** Le categorie del tipo scelto; vuote per i trasferimenti, che non ne hanno. */
  protected readonly categories = computed(() => {
    const kind = this.kind();
    return kind === 'Income' || kind === 'Expense' ? categoryTree(this.data.categories, kind) : [];
  });

  protected readonly errors = signal<string[]>([]);

  constructor() {
    // Una categoria di uscita non vale per un'entrata: cambiando tipo si riparte da capo.
    this.form.controls.kind.valueChanges.subscribe(() => this.form.controls.categoryId.setValue(null));
  }

  protected save(): Promise<void> {
    const { kind, date, amount, accountId, ...rest } = this.form.getRawValue();
    // Il pulsante Salva è spento finché questi campi obbligatori mancano.
    const input = { kind: kind!, date: date!, amount: amount!, accountId: accountId!, ...rest };
    return submitDialog(this.ref, this.errors, () => this.movements.save(input, this.data.movement?.id));
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.movements.remove(this.data.movement!.id));
  }
}
