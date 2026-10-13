import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { Account, AccountsService } from '../accounts/accounts.service';
import { CategoriesService, Category, categoryLabels } from '../categories/categories.service';
import { DayList } from '../movements/day-list';
import { MovementDialog, MovementDialogData } from '../movements/movement-dialog';
import { Movement, MovementKind, MovementsService, SearchCriteria, SearchResult } from '../movements/movements.service';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';

/** Cerca tra tutti i movimenti per testo, periodo, conto, categoria e tipo; il risultato si può esportare in CSV. */
@Component({
  selector: 'app-search',
  imports: [DayList, EurPipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <main class="page">
      <h1>Cerca</h1>

      <mat-card appearance="outlined">
        <form class="filters" [formGroup]="form" (ngSubmit)="search()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Testo nella nota</mat-label>
            <input matInput formControlName="text" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Dal</mat-label>
            <input matInput type="date" formControlName="from" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Al</mat-label>
            <input matInput type="date" formControlName="to" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Conto</mat-label>
            <mat-select formControlName="accountId">
              <mat-option [value]="null">Tutti</mat-option>
              @for (account of accounts(); track account.id) {
                <mat-option [value]="account.id">{{ account.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option [value]="null">Tutte</mat-option>
              @for (option of categoryOptions(); track option.id) {
                <mat-option [value]="option.id">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="kind">
              <mat-option [value]="null">Tutti</mat-option>
              <mat-option value="Expense">Uscite</mat-option>
              <mat-option value="Income">Entrate</mat-option>
              <mat-option value="Transfer">Trasferimenti</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="actions">
            <button matButton="filled" type="submit">Cerca</button>
            <!-- Scarica ciò che corrisponde all'ultima ricerca fatta, non ai filtri ancora da applicare. -->
            <a matButton [href]="exportUrl()" download>Esporta CSV</a>
          </div>
        </form>
      </mat-card>

      @if (result(); as result) {
        <mat-card appearance="outlined">
          <div class="totals">
            <span>Entrate <strong class="income">{{ result.ledger.income | eur }}</strong></span>
            <span>Uscite <strong class="expense">{{ result.ledger.expense | eur }}</strong></span>
            <span>Saldo <strong>{{ result.ledger.income - result.ledger.expense | eur }}</strong></span>
          </div>
        </mat-card>

        @if (result.truncated) {
          <p class="muted">
            Sono mostrati i 500 movimenti più recenti: restringi i filtri per vedere gli altri. L'esportazione li contiene tutti.
          </p>
        }

        <app-day-list [days]="result.ledger.days" [accounts]="accounts()" [categories]="categories()" (opened)="open($event)" />
        @if (!result.ledger.days.length) {
          <p class="muted">Nessun movimento corrisponde ai filtri.</p>
        }
      }
    </main>
  `,
  styles: `
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      padding: 1rem;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class Search {
  private readonly movements = inject(MovementsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);

  protected readonly form = inject(FormBuilder).group({
    text: [null as string | null],
    from: [null as string | null],
    to: [null as string | null],
    accountId: [null as string | null],
    categoryId: [null as string | null],
    kind: [null as MovementKind | null],
  });

  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly result = signal<SearchResult | null>(null);
  private readonly applied = signal<SearchCriteria>(this.form.getRawValue());

  protected readonly categoryOptions = computed(() =>
    [...categoryLabels(this.categories())]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'it')),
  );

  protected readonly exportUrl = computed(() => this.movements.exportUrl(this.applied()));

  constructor() {
    void this.load();
  }

  protected async search(): Promise<void> {
    this.applied.set(this.form.getRawValue());
    this.result.set(await this.movements.search(this.applied()));
  }

  protected async open(movement: Movement): Promise<void> {
    const data: MovementDialogData = {
      movement,
      recurrence: null,
      date: movement.date,
      accounts: this.accounts(),
      categories: this.categories(),
    };
    if (await firstValueFrom(this.dialog.open(MovementDialog, formDialog(data)).afterClosed())) await this.search();
  }

  private async load(): Promise<void> {
    const [overview, categories] = await Promise.all([this.accountsService.list(), this.categoriesService.list()]);
    this.accounts.set(overview.accounts);
    this.categories.set(categories);
    await this.search();
  }
}
