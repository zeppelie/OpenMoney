import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Icon } from '../layout/icon';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';
import { AccountDialog } from './account-dialog';
import { Account, AccountsOverview, AccountsService, accountGroups } from './accounts.service';

@Component({
  selector: 'app-accounts',
  imports: [EurPipe, Icon, MatButtonModule, MatCardModule],
  template: `
    <main class="page">
      <h1>Conti</h1>

      @if (overview(); as overview) {
        <mat-card appearance="outlined">
          <div class="totals">
            <span>Attività <strong class="income">{{ overview.netWorth.assets | eur }}</strong></span>
            <span>Passività <strong class="expense">{{ overview.netWorth.liabilities | eur }}</strong></span>
            <span>Totale <strong>{{ overview.netWorth.total | eur }}</strong></span>
          </div>
        </mat-card>

        @for (group of groups(); track group.label) {
          <mat-card appearance="outlined">
            <div class="row head">
              <span>{{ group.label }}</span>
              <span>{{ group.total | eur }}</span>
            </div>
            @for (account of group.accounts; track account.id) {
              <button type="button" class="row" (click)="open(account)">
                <span>{{ account.name }}</span>
                <span [class.expense]="account.balance < 0">{{ account.balance | eur }}</span>
              </button>
            }
          </mat-card>
        } @empty {
          <p class="muted">Ancora nessun conto: aggiungi il primo, per esempio il conto in banca o i contanti.</p>
        }
      }

      <button matFab extended class="fab" type="button" (click)="open(null)">
        <app-icon name="add" />
        Conto
      </button>
    </main>
  `,
})
export class Accounts {
  private readonly accounts = inject(AccountsService);
  private readonly dialog = inject(MatDialog);

  protected readonly overview = signal<AccountsOverview | null>(null);

  /** Solo i gruppi che hanno almeno un conto, ognuno con il suo totale. */
  protected readonly groups = computed(() =>
    accountGroups
      .map(({ group, label }) => {
        const accounts = (this.overview()?.accounts ?? []).filter((account) => account.group === group);
        return { label, accounts, total: accounts.reduce((sum, account) => sum + account.balance, 0) };
      })
      .filter((group) => group.accounts.length),
  );

  constructor() {
    void this.load();
  }

  protected async open(account: Account | null): Promise<void> {
    const saved = await firstValueFrom(this.dialog.open(AccountDialog, formDialog(account)).afterClosed());
    if (saved) await this.load();
  }

  private async load(): Promise<void> {
    this.overview.set(await this.accounts.list());
  }
}
