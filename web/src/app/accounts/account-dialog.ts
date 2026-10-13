import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { submitDialog } from '../shared/dialogs';
import { Account, AccountGroup, AccountsService, accountGroups } from './accounts.service';

/** Crea un conto o, se riceve un conto, lo modifica o lo elimina. */
@Component({
  selector: 'app-account-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ account ? 'Modifica conto' : 'Nuovo conto' }}</h2>
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
        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (account) {
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
  protected readonly account = inject<Account | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AccountDialog, boolean>>(MatDialogRef);
  private readonly accounts = inject(AccountsService);
  protected readonly groups = accountGroups;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.account?.name ?? '', Validators.required],
    group: [this.account?.group ?? ('Bank' as AccountGroup)],
    initialBalance: [this.account?.initialBalance ?? 0, Validators.required],
  });

  protected readonly errors = signal<string[]>([]);

  protected save(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.accounts.save(this.form.getRawValue(), this.account?.id));
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () => this.accounts.remove(this.account!.id));
  }
}
