import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Account, AccountsService } from '../accounts/accounts.service';
import { CategoriesService, Category, categoryLabels } from '../categories/categories.service';
import { Icon } from '../layout/icon';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';
import { MovementDialog, MovementDialogData } from './movement-dialog';
import { DayLedger, MonthLedger, MonthTotals, Movement, MovementsService } from './movements.service';

interface CalendarCell {
  /** Giorno del mese; null per le caselle vuote prima del giorno 1. */
  day: number | null;
  date: string;
  income: number;
  expense: number;
}

const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' });
const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric' });
const weekdays = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** I movimenti di un mese in tre viste: elenco per giorni, calendario e riepilogo dell'anno. */
@Component({
  selector: 'app-movements',
  imports: [EurPipe, Icon, MatButtonModule, MatCardModule, MatTabsModule, RouterLink],
  template: `
    <main class="page">
      <div class="month">
        <button matIconButton type="button" (click)="shift(-1)" aria-label="Mese precedente">
          <app-icon name="chevronLeft" />
        </button>
        <h1>{{ title() }}</h1>
        <button matIconButton type="button" (click)="shift(1)" aria-label="Mese successivo">
          <app-icon name="chevronRight" />
        </button>
      </div>

      <mat-card appearance="outlined">
        <div class="totals">
          <span>Entrate <strong class="income">{{ ledger().income | eur }}</strong></span>
          <span>Uscite <strong class="expense">{{ ledger().expense | eur }}</strong></span>
          <span>Saldo <strong>{{ ledger().income - ledger().expense | eur }}</strong></span>
        </div>
      </mat-card>

      <mat-tab-group [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)" dynamicHeight>
        <mat-tab label="Giorni">
          @for (day of ledger().days; track day.date) {
            <mat-card appearance="outlined" class="day">
              <div class="row head">
                <span>{{ dayLabel(day) }}</span>
                <span class="amounts">
                  <span class="income">{{ day.income | eur }}</span>
                  <span class="expense">{{ day.expense | eur }}</span>
                </span>
              </div>
              @for (movement of day.movements; track movement.id) {
                <button type="button" class="row" (click)="open(movement)">
                  <span class="what">
                    <span>{{ what(movement) }}</span>
                    <span class="muted">{{ details(movement) }}</span>
                  </span>
                  <span [class]="movement.kind.toLowerCase()">{{ movement.amount | eur }}</span>
                </button>
              }
            </mat-card>
          } @empty {
            <p class="muted empty">
              Nessun movimento in questo mese.
              @if (loaded() && !accounts().length) {
                Per registrarne uno serve almeno un conto: <a routerLink="/conti">creane uno</a>.
              }
            </p>
          }
        </mat-tab>

        <mat-tab label="Calendario">
          <div class="calendar">
            @for (weekday of weekdays; track weekday) {
              <span class="weekday muted">{{ weekday }}</span>
            }
            @for (cell of calendar(); track $index) {
              @if (cell.day) {
                <button type="button" class="cell" (click)="open(null, cell.date)">
                  <span>{{ cell.day }}</span>
                  @if (cell.income) {
                    <span class="income">{{ cell.income | eur }}</span>
                  }
                  @if (cell.expense) {
                    <span class="expense">{{ cell.expense | eur }}</span>
                  }
                </button>
              } @else {
                <span></span>
              }
            }
          </div>
        </mat-tab>

        <mat-tab [label]="'Anno ' + period().year">
          <mat-card appearance="outlined" class="day">
            @for (totals of yearTotals(); track totals.month) {
              <button type="button" class="row" (click)="goTo(totals.month)">
                <span class="what month-name">{{ monthLabel(totals.month) }}</span>
                <span class="amounts">
                  <span class="income">{{ totals.income | eur }}</span>
                  <span class="expense">{{ totals.expense | eur }}</span>
                  <span>{{ totals.income - totals.expense | eur }}</span>
                </span>
              </button>
            }
          </mat-card>
        </mat-tab>
      </mat-tab-group>

      @if (accounts().length) {
        <button matFab extended class="fab" type="button" (click)="open(null)">
          <app-icon name="add" />
          Movimento
        </button>
      }
    </main>
  `,
  styles: `
    .month {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .month h1 {
      min-width: 11rem;
      margin: 0;
      text-align: center;
      text-transform: capitalize;
    }

    .day {
      margin-top: 0.75rem;
    }

    .head span:first-child {
      text-transform: capitalize;
    }

    .what {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .what .muted {
      font: var(--mat-sys-body-small);
    }

    .month-name {
      text-transform: capitalize;
    }

    .amounts {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0 1rem;
    }

    .empty {
      padding: 1rem 0;
    }

    .calendar {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.25rem;
      padding-top: 0.75rem;
    }

    .weekday {
      font: var(--mat-sys-label-medium);
      text-align: center;
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-height: 4.5rem;
      padding: 0.25rem;
      overflow: hidden;
      color: inherit;
      font: var(--mat-sys-label-small);
      text-align: left;
      background: none;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.5rem;
      cursor: pointer;
    }

    .cell span:first-child {
      font: var(--mat-sys-label-large);
    }
  `,
})
export class Movements {
  private readonly movements = inject(MovementsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);
  protected readonly weekdays = weekdays;

  private readonly today = new Date();
  protected readonly period = signal({ year: this.today.getFullYear(), month: this.today.getMonth() + 1 });
  protected readonly tab = signal(0);
  protected readonly loaded = signal(false);

  protected readonly ledger = signal<MonthLedger>({ income: 0, expense: 0, days: [] });
  protected readonly yearTotals = signal<MonthTotals[]>([]);
  protected readonly accounts = signal<Account[]>([]);
  private readonly categories = signal<Category[]>([]);

  private readonly accountNames = computed(() => new Map(this.accounts().map((account) => [account.id, account.name])));
  private readonly categoryNames = computed(() => categoryLabels(this.categories()));

  protected readonly title = computed(() => `${this.monthLabel(this.period().month)} ${this.period().year}`);

  /** Le caselle del mese, con le vuote necessarie perché il giorno 1 cada sotto il suo giorno della settimana. */
  protected readonly calendar = computed<CalendarCell[]>(() => {
    const { year, month } = this.period();
    const byDate = new Map(this.ledger().days.map((day) => [day.date, day]));
    // getDay() conta da domenica; la settimana qui parte da lunedì.
    const blanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: blanks + daysInMonth }, (_, index) => {
      const day = index < blanks ? null : index - blanks + 1;
      const date = day ? isoDate(year, month, day) : '';
      return { day, date, income: byDate.get(date)?.income ?? 0, expense: byDate.get(date)?.expense ?? 0 };
    });
  });

  constructor() {
    void this.load();
  }

  protected monthLabel(month: number): string {
    return monthName.format(new Date(2000, month - 1, 1));
  }

  protected dayLabel(day: DayLedger): string {
    return dayName.format(new Date(`${day.date}T00:00`));
  }

  /** Prima riga di un movimento: la categoria, o i due conti di un trasferimento. */
  protected what(movement: Movement): string {
    const account = this.accountNames().get(movement.accountId);
    return movement.kind === 'Transfer'
      ? `${account} → ${this.accountNames().get(movement.toAccountId!)}`
      : (this.categoryNames().get(movement.categoryId!) ?? '');
  }

  /** Seconda riga: nota, conto e chi l'ha inserito. */
  protected details(movement: Movement): string {
    const account = movement.kind === 'Transfer' ? 'Trasferimento' : this.accountNames().get(movement.accountId);
    return [movement.note, account, movement.author].filter(Boolean).join(' · ');
  }

  protected shift(months: number): Promise<void> {
    const { year, month } = this.period();
    const moved = new Date(year, month - 1 + months, 1);
    this.period.set({ year: moved.getFullYear(), month: moved.getMonth() + 1 });
    return this.load();
  }

  protected goTo(month: number): Promise<void> {
    this.period.update((period) => ({ ...period, month }));
    this.tab.set(0);
    return this.load();
  }

  /** Apre il modulo: su un movimento per modificarlo, altrimenti per inserirne uno nella data indicata. */
  protected async open(movement: Movement | null, date = this.defaultDate()): Promise<void> {
    const data: MovementDialogData = { movement, date, accounts: this.accounts(), categories: this.categories() };
    if (await firstValueFrom(this.dialog.open(MovementDialog, formDialog(data)).afterClosed())) await this.load();
  }

  /** Oggi se si sta guardando il mese corrente, altrimenti il primo giorno del mese mostrato. */
  private defaultDate(): string {
    const { year, month } = this.period();
    const isCurrentMonth = year === this.today.getFullYear() && month === this.today.getMonth() + 1;
    return isoDate(year, month, isCurrentMonth ? this.today.getDate() : 1);
  }

  private async load(): Promise<void> {
    const { year, month } = this.period();
    const [ledger, yearTotals, overview, categories] = await Promise.all([
      this.movements.month(year, month),
      this.movements.year(year),
      this.accountsService.list(),
      this.categoriesService.list(),
    ]);
    this.ledger.set(ledger);
    this.yearTotals.set(yearTotals);
    this.accounts.set(overview.accounts);
    this.categories.set(categories);
    this.loaded.set(true);
  }
}
