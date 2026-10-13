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
import { Frequency, Recurrence, RecurrencesService, frequencies } from '../recurrences/recurrences.service';
import { submitDialog } from '../shared/dialogs';
import { Movement, MovementKind, MovementsService } from './movements.service';

export interface MovementDialogData {
  /** Il movimento da modificare; null per crearne uno o per lavorare su una ricorrenza. */
  movement: Movement | null;
  /** La ricorrenza da modificare; null negli altri casi. */
  recurrence: Recurrence | null;
  /** Data proposta per un movimento nuovo (ISO aaaa-mm-gg). */
  date: string;
  accounts: Account[];
  categories: Category[];
}

/**
 * Inserisce un'entrata, un'uscita o un trasferimento. Scegliendo "Ripeti" il movimento diventa una ricorrenza
 * (con un numero di volte, un piano di rate). Se riceve un movimento o una ricorrenza li modifica o li elimina.
 */
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
    <h2 mat-dialog-title>{{ title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-button-toggle-group formControlName="kind" aria-label="Tipo di movimento" hideSingleSelectionIndicator>
          <mat-button-toggle value="Expense">Uscita</mat-button-toggle>
          <mat-button-toggle value="Income">Entrata</mat-button-toggle>
          <mat-button-toggle value="Transfer">Trasferimento</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ repeats() ? 'Prima data' : 'Data' }}</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Importo (€)</mat-label>
          <input matInput type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="amount" />
          @if (repeats()) {
            <mat-hint>L'importo di ogni volta (di ogni rata), non il totale.</mat-hint>
          }
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
                  <mat-option [value]="child.id">{{ node.category.name }} › {{ child.name }}</mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nota</mat-label>
          <input matInput formControlName="note" maxlength="200" />
        </mat-form-field>

        @if (!data.movement) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Ripeti</mat-label>
            <mat-select formControlName="frequency">
              @if (!data.recurrence) {
                <mat-option value="None">Mai</mat-option>
              }
              @for (item of frequencies; track item.frequency) {
                <mat-option [value]="item.frequency">{{ item.label }}</mat-option>
              }
            </mat-select>
            @if (data.recurrence) {
              <mat-hint>Prima data e frequenza non si cambiano: per farlo elimina la ricorrenza e creane una nuova.</mat-hint>
            }
          </mat-form-field>
        }

        @if (repeats()) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Numero di volte (rate)</mat-label>
            <input matInput type="number" step="1" min="1" inputmode="numeric" formControlName="occurrences" />
            <mat-hint>Vuoto: senza limite.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Fino al</mat-label>
            <input matInput type="date" formControlName="endDate" />
          </mat-form-field>
        }

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.movement || data.recurrence) {
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
  private readonly recurrences = inject(RecurrencesService);
  protected readonly frequencies = frequencies;

  protected readonly title = this.data.recurrence
    ? 'Modifica ricorrenza'
    : this.data.movement
      ? 'Modifica movimento'
      : 'Nuovo movimento';

  // Di una ricorrenza si modifica il modello: i suoi campi sono quelli di un movimento.
  private readonly source = this.data.recurrence?.movement ?? this.data.movement;
  // Il calendario di una ricorrenza esistente è fisso (vedi il suggerimento sotto "Ripeti").
  private readonly scheduleLocked = !!this.data.recurrence;

  protected readonly form = inject(FormBuilder).group({
    kind: [this.source?.kind ?? ('Expense' as MovementKind), Validators.required],
    date: [{ value: this.source?.date ?? this.data.date, disabled: this.scheduleLocked }, Validators.required],
    amount: [this.source?.amount ?? null, [Validators.required, Validators.min(0.01)]],
    accountId: [this.source?.accountId ?? this.data.accounts[0]?.id ?? null, Validators.required],
    toAccountId: [this.source?.toAccountId ?? null],
    categoryId: [this.source?.categoryId ?? null],
    note: [this.source?.note ?? null],
    frequency: [
      { value: this.data.recurrence?.frequency ?? ('None' as Frequency | 'None'), disabled: this.scheduleLocked },
    ],
    occurrences: [this.data.recurrence?.occurrences ?? null, Validators.min(1)],
    endDate: [this.data.recurrence?.endDate ?? null],
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, { initialValue: this.form.controls.kind.value });
  private readonly frequency = toSignal(this.form.controls.frequency.valueChanges, {
    initialValue: this.form.controls.frequency.value,
  });
  protected readonly repeats = computed(() => this.frequency() !== 'None');

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
    const { kind, date, amount, accountId, frequency, occurrences, endDate, ...rest } = this.form.getRawValue();
    // Il pulsante Salva è spento finché questi campi obbligatori mancano.
    const movement = { kind: kind!, date: date!, amount: amount!, accountId: accountId!, ...rest };

    return submitDialog(this.ref, this.errors, () =>
      frequency && frequency !== 'None'
        ? // Un campo data svuotato vale "", che per il server non è una data.
          this.recurrences.save({ movement, frequency, occurrences, endDate: endDate || null }, this.data.recurrence?.id)
        : this.movements.save(movement, this.data.movement?.id),
    );
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () =>
      this.data.recurrence
        ? this.recurrences.remove(this.data.recurrence.id)
        : this.movements.remove(this.data.movement!.id),
    );
  }
}
