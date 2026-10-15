import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Account, AccountsService } from '../accounts/accounts.service';
import { CategoriesService, Category } from '../categories/categories.service';
import { Icon } from '../layout/icon';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';
import { MonthNav } from '../shared/month-nav';
import { MonthSummary } from '../shared/month-summary';
import { Period, currentPeriod, isoDate, monthLabel } from '../shared/period';
import { DayList } from './day-list';
import { MovementDialog, MovementDialogData } from './movement-dialog';
import { MonthLedger, MonthTotals, Movement, MovementsService } from './movements.service';

interface CalendarCell {
  /** Giorno del mese; null per le caselle vuote prima del giorno 1. */
  day: number | null;
  date: string;
  income: number;
  expense: number;
}

const weekdays = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/** I movimenti di un mese in quattro viste: elenco per giorni, calendario, settimane e riepilogo dell'anno. */
@Component({
  selector: 'app-movements',
  imports: [DayList, EurPipe, Icon, MatButtonModule, MatCardModule, MatTabsModule, MonthNav, MonthSummary, RouterLink],
  template: `
    <main class="page">
      <app-month-nav [period]="period()" (periodChange)="show($event)">
        <a band-action matIconButton routerLink="/cerca" aria-label="Cerca tra i movimenti"><app-icon name="search" /></a>
        <app-month-summary [income]="ledger().income" [expense]="ledger().expense" />
      </app-month-nav>

      <mat-tab-group [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)" dynamicHeight>
        <mat-tab label="Giorni">
          <app-day-list class="tab" [days]="ledger().days" [accounts]="accounts()" [categories]="categories()" (opened)="open($event)" />
          @if (!ledger().days.length) {
            <p class="muted">
              Nessun movimento in questo mese.
              @if (loaded() && !accounts().length) {
                Per registrarne uno serve almeno un conto: <a routerLink="/conti">creane uno</a>.
              }
            </p>
          }
        </mat-tab>

        <mat-tab label="Calendario">
          <div class="calendar tab">
            @for (weekday of weekdays; track weekday) {
              <span class="weekday muted">{{ weekday }}</span>
            }
            @for (cell of calendar(); track $index) {
              @if (cell.day) {
                <button type="button" class="cell" [class.today]="cell.date === todayIso" (click)="open(null, cell.date)">
                  <span>{{ cell.day }}</span>
                  @if (cell.income) {
                    <span class="income amount">+{{ cell.income | eur }}</span>
                  }
                  @if (cell.expense) {
                    <span class="amount">−{{ cell.expense | eur }}</span>
                  }
                </button>
              } @else {
                <span></span>
              }
            }
          </div>
        </mat-tab>

        <mat-tab label="Settimane">
          <mat-card appearance="outlined" class="tab">
            @for (week of weeks(); track week.label) {
              <div class="row">
                <span>{{ week.label }}</span>
                <span class="amounts">
                  <span class="income">+{{ week.income | eur }}</span>
                  <span>−{{ week.expense | eur }}</span>
                </span>
              </div>
            }
          </mat-card>
        </mat-tab>

        <mat-tab label="Anno">
          <mat-card appearance="outlined" class="tab">
            @for (totals of yearTotals(); track totals.month) {
              <button type="button" class="row" (click)="goTo(totals.month)">
                <span class="month-name">{{ monthLabel(totals.month) }}</span>
                <span class="amounts">
                  <span class="income">+{{ totals.income | eur }}</span>
                  <span>−{{ totals.expense | eur }}</span>
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
    .tab {
      margin-top: 0.75rem;
    }

    // Sul telefono le quattro viste devono stare tutte in vista, senza frecce per scorrerle.
    @media (max-width: 599.98px) {
      mat-tab-group ::ng-deep .mat-mdc-tab {
        min-width: 0;
        padding: 0 0.5rem;
      }
    }

    .tab .row:first-child {
      border-top: 0;
    }

    .month-name {
      text-transform: capitalize;
    }

    .amounts {
      font-variant-numeric: tabular-nums;
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0 1rem;
    }

    .calendar {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.25rem;
    }

    .weekday {
      font: var(--mat-sys-label-medium);
      text-align: center;
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-height: 4.75rem;
      padding: 0.375rem 0.5rem;
      overflow: hidden;
      color: inherit;
      font-size: 0.75rem;
      text-align: left;
      background: var(--om-carta);
      border: 0;
      border-radius: 12px;
      cursor: pointer;
    }

    .cell:hover {
      background: var(--om-rosa);
    }

    .cell span:first-child {
      font: 600 1rem/1.2 var(--om-display);
    }

    // Oggi si riconosce dal bordo rosso, senza riempire la casella.
    .cell.today {
      box-shadow: inset 0 0 0 2px var(--om-salvadanaio);
    }

    @media (max-width: 599.98px) {
      .cell {
        min-height: 3.75rem;
        padding: 0.25rem;
        font-size: 0.625rem;
      }
    }
  `,
})
export class Movements {
  private readonly movements = inject(MovementsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);
  protected readonly weekdays = weekdays;
  protected readonly monthLabel = monthLabel;

  private readonly today = new Date();
  protected readonly todayIso = isoDate(this.today.getFullYear(), this.today.getMonth() + 1, this.today.getDate());
  protected readonly period = signal(currentPeriod());
  protected readonly tab = signal(0);
  protected readonly loaded = signal(false);

  protected readonly ledger = signal<MonthLedger>({ income: 0, expense: 0, days: [] });
  protected readonly yearTotals = signal<MonthTotals[]>([]);
  protected readonly accounts = signal<Account[]>([]);
  protected readonly categories = signal<Category[]>([]);

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

  /** Le settimane del mese (da lunedì a domenica, tagliate ai suoi giorni) con i loro totali: sono le righe del calendario. */
  protected readonly weeks = computed(() => {
    const cells = this.calendar();
    const month = monthLabel(this.period().month);
    return Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => {
      const days = cells.slice(week * 7, week * 7 + 7).filter((cell) => cell.day);
      return {
        label: `${days[0].day} – ${days[days.length - 1].day} ${month}`,
        income: days.reduce((sum, cell) => sum + cell.income, 0),
        expense: days.reduce((sum, cell) => sum + cell.expense, 0),
      };
    });
  });

  constructor() {
    void this.load();
  }

  protected show(period: Period): Promise<void> {
    this.period.set(period);
    return this.load();
  }

  /** Dal riepilogo dell'anno: apre l'elenco dei giorni di quel mese. */
  protected goTo(month: number): Promise<void> {
    this.tab.set(0);
    return this.show({ ...this.period(), month });
  }

  /** Apre il modulo: su un movimento per modificarlo, altrimenti per inserirne uno nella data indicata. */
  protected async open(movement: Movement | null, date = this.defaultDate()): Promise<void> {
    const data: MovementDialogData = {
      movement,
      recurrence: null,
      date,
      accounts: this.accounts(),
      categories: this.categories(),
    };
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
