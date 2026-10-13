import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { submitDialog } from '../shared/dialogs';
import { Account, AccountGroup, AccountsService, accountGroups } from './accounts.service';

export interface AccountDialogData {
  /** Il conto da modificare; null per crearne uno. */
  account: Account | null;
  /** Tutti i conti: tra questi si sceglie quello su cui addebitare una carta. */
  accounts: Account[];
}

// Il giorno più comune per l'addebito delle carte a saldo.
const usualSettlementDay = 15;

/** Crea un conto o, se riceve un conto, lo modifica o lo elimina. */
@Component({
  selector: 'app-account-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.account ? 'Modifica conto' : 'Nuovo conto' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" maxlength="60" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Gruppo</mat-label>
          <mat-select formControlName="group">
            @for (item of groups; track item.group) {
              <mat-option [value]="item.group">{{ item.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Saldo iniziale (€)</mat-label>
          <input matInput type="number" step="0.01" inputmode="decimal" formControlName="initialBalance" />
          <mat-hint>Negativo se è un debito.</mat-hint>
        </mat-form-field>

        @if (isCard()) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Addebito automatico sul conto</mat-label>
            <mat-select formControlName="settlementAccountId">
              <mat-option [value]="null">Nessuno</mat-option>
              @for (account of settlementAccounts; track account.id) {
                <mat-option [value]="account.id">{{ account.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Le spese di ogni mese vengono addebitate su questo conto il mese dopo.</mat-hint>
          </mat-form-field>
          @if (settles()) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Giorno di addebito</mat-label>
              <input matInput type="number" step="1" min="1" max="28" inputmode="numeric" formControlName="settlementDay" />
              <mat-hint>Da 1 a 28, del mese successivo.</mat-hint>
            </mat-form-field>
          }
        }

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.account) {
          <button matButton type="button" (click)="remove()">Elimina</button>
        }
        <span class="spacer"></span>
        <button matButton type="button" mat-dialog-close>Annulla</button>
        <button matButton="filled" type="submit" [disabled]="form.invalid">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class AccountDialog {
  protected readonly data = inject<AccountDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AccountDialog, boolean>>(MatDialogRef);
  private readonly accounts = inject(AccountsService);
  protected readonly groups = accountGroups;

  // Una carta non si addebita su se stessa né, di norma, su un'altra carta.
  protected readonly settlementAccounts = this.data.accounts.filter(
    (account) => account.id !== this.data.account?.id && account.group !== 'Card',
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.account?.name ?? '', Validators.required],
    group: [this.data.account?.group ?? ('Bank' as AccountGroup)],
    initialBalance: [this.data.account?.initialBalance ?? 0, Validators.required],
    settlementAccountId: [this.data.account?.settlementAccountId ?? null],
    settlementDay: [
      this.data.account?.settlementDay ?? usualSettlementDay,
      [Validators.required, Validators.min(1), Validators.max(28)],
    ],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly isCard = computed(() => this.values().group === 'Card');
  protected readonly settles = computed(() => !!this.values().settlementAccountId);

  protected readonly errors = signal<string[]>([]);

  protected save(): Promise<void> {
    const { settlementAccountId, settlementDay, ...account } = this.form.getRawValue();
    // Il giorno conta solo se c'è un conto di addebito; il server scarta entrambi per i conti che non sono carte.
    const settlement = settlementAccountId
      ? { settlementAccountId, settlementDay }
      : { settlementAccountId: null, settlementDay: null };
    return submitDialog(this.ref, this.errors, () =>
      this.accounts.save({ ...account, ...settlement }, this.data.account?.id),
    );
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.accounts.remove(this.data.account!.id));
  }
}
