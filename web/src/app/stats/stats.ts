import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';
import { CategoryKind } from '../categories/categories.service';
import { MonthTotals, MovementsService } from '../movements/movements.service';
import { EurPipe } from '../shared/money';
import { MonthNav } from '../shared/month-nav';
import { Period, currentPeriod, monthLabel } from '../shared/period';

interface CategoryShare {
  categoryId: string;
  name: string;
  total: number;
  percent: number;
}

interface Breakdown {
  total: number;
  shares: CategoryShare[];
}

/** Un arco della ciambella: `dash` e `offset` lo disegnano come tratto di una circonferenza. */
interface Slice {
  name: string;
  total: number;
  color: string;
  dash: string;
  offset: number;
}

interface YearBar {
  label: string;
  x: number;
  income: { y: number; height: number };
  expense: { y: number; height: number };
  totals: MonthTotals;
}

// La palette ha otto colori distinguibili anche da chi non vede bene i colori: oltre, le categorie minori
// confluiscono in "Altro" invece di ricevere colori inventati.
const maxSlices = 8;
const seriesColor = (slot: number) => `var(--series-${slot})`;

const radius = 45;
const circumference = 2 * Math.PI * radius;
// Stacco tra un arco e il successivo, perché due colori vicini non si tocchino.
const sliceGap = 1.5;

const chartHeight = 110;
const monthWidth = 30;
const barWidth = 10;

/** Dove va il denaro: quote per categoria del mese (ciambella ed elenco) e andamento dell'anno (barre). */
@Component({
  selector: 'app-stats',
  imports: [EurPipe, MatButtonToggleModule, MatCardModule, MonthNav],
  template: `
    <main class="page">
      <app-month-nav [period]="period()" (periodChange)="show($event)" />

      <mat-button-toggle-group
        [value]="kind()"
        (change)="showKind($event.value)"
        aria-label="Entrate o uscite"
        hideSingleSelectionIndicator
      >
        <mat-button-toggle value="Expense">Uscite</mat-button-toggle>
        <mat-button-toggle value="Income">Entrate</mat-button-toggle>
      </mat-button-toggle-group>

      <mat-card appearance="outlined">
        @if (breakdown().shares.length) {
          <div class="breakdown">
            <svg class="donut" viewBox="0 0 120 120" role="img" [attr.aria-label]="'Quote per categoria, totale ' + (breakdown().total | eur)">
              <g transform="rotate(-90 60 60)">
                @for (slice of slices(); track slice.name) {
                  <circle
                    cx="60"
                    cy="60"
                    [attr.r]="radius"
                    fill="none"
                    stroke-width="18"
                    [attr.stroke]="slice.color"
                    [attr.stroke-dasharray]="slice.dash"
                    [attr.stroke-dashoffset]="slice.offset"
                  >
                    <title>{{ slice.name }}: {{ slice.total | eur }}</title>
                  </circle>
                }
              </g>
              <text x="60" y="57" class="donut-label">{{ kind() === 'Expense' ? 'Uscite' : 'Entrate' }}</text>
              <text x="60" y="70" class="donut-total">{{ breakdown().total | eur }}</text>
            </svg>

            <ul class="shares">
              @for (share of breakdown().shares; track share.categoryId; let index = $index) {
                <li>
                  <span class="swatch" [style.background]="colorOf(index)"></span>
                  <span class="name">{{ share.name }}</span>
                  <span class="muted">{{ percent.format(share.percent) }} %</span>
                  <span class="amount">{{ share.total | eur }}</span>
                </li>
              }
            </ul>
          </div>
        } @else {
          <p class="muted empty">Nessun movimento di questo tipo nel mese.</p>
        }
      </mat-card>

      <mat-card appearance="outlined">
        <div class="year">
          <h2>Anno {{ period().year }}</h2>
          <p class="legend">
            <span><span class="swatch income-bar"></span>Entrate</span>
            <span><span class="swatch expense-bar"></span>Uscite</span>
          </p>
          <svg class="bars" [attr.viewBox]="'0 0 360 ' + (chartHeight + 20)" role="img" [attr.aria-label]="'Entrate e uscite per mese, anno ' + period().year">
            <line x1="0" x2="360" [attr.y1]="chartHeight" [attr.y2]="chartHeight" class="baseline" />
            @for (bar of yearBars(); track bar.totals.month) {
              <g>
                <title>{{ bar.label }}: entrate {{ bar.totals.income | eur }}, uscite {{ bar.totals.expense | eur }}</title>
                <rect [attr.x]="bar.x" [attr.y]="bar.income.y" [attr.height]="bar.income.height" [attr.width]="barWidth" rx="2" class="income-bar" />
                <rect [attr.x]="bar.x + barWidth + 2" [attr.y]="bar.expense.y" [attr.height]="bar.expense.height" [attr.width]="barWidth" rx="2" class="expense-bar" />
                <text [attr.x]="bar.x + barWidth + 1" [attr.y]="chartHeight + 14" class="tick">{{ bar.label.slice(0, 3) }}</text>
              </g>
            }
          </svg>
        </div>
      </mat-card>
    </main>
  `,
  styles: `
    :host {
      // Otto colori in ordine fisso, scelti per restare distinguibili tra vicini; chiaro e scuro.
      --series-1: light-dark(#2a78d6, #3987e5);
      --series-2: light-dark(#eb6834, #d95926);
      --series-3: light-dark(#1baf7a, #199e70);
      --series-4: light-dark(#eda100, #c98500);
      --series-5: light-dark(#e87ba4, #d55181);
      --series-6: light-dark(#008300, #008300);
      --series-7: light-dark(#4a3aa7, #9085e9);
      --series-8: light-dark(#e34948, #e66767);
    }

    mat-button-toggle-group {
      justify-self: start;
    }

    .breakdown {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem;
    }

    .donut {
      flex: 0 0 12rem;
      width: 12rem;
      margin: 0 auto;
    }

    .donut text {
      text-anchor: middle;
      fill: var(--mat-sys-on-surface);
    }

    .donut-label {
      font-size: 7px;
      fill: var(--mat-sys-on-surface-variant);
    }

    .donut-total {
      font-size: 10px;
      font-weight: 600;
    }

    .shares {
      display: grid;
      flex: 1 1 16rem;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .shares li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .amount {
      min-width: 6rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .swatch {
      display: inline-block;
      flex: none;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 0.2rem;
    }

    .empty,
    .year {
      padding: 1rem;
    }

    .legend {
      display: flex;
      gap: 1rem;
      font: var(--mat-sys-label-medium);
    }

    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .bars {
      width: 100%;
      max-height: 16rem;
    }

    .income-bar {
      fill: var(--series-1);
      background: var(--series-1);
    }

    .expense-bar {
      fill: var(--series-8);
      background: var(--series-8);
    }

    .baseline {
      stroke: var(--mat-sys-outline-variant);
      stroke-width: 1;
    }

    .tick {
      font-size: 8px;
      text-anchor: middle;
      fill: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Stats {
  private readonly http = inject(HttpClient);
  private readonly movements = inject(MovementsService);
  protected readonly radius = radius;
  protected readonly chartHeight = chartHeight;
  protected readonly barWidth = barWidth;
  protected readonly percent = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

  protected readonly period = signal(currentPeriod());
  protected readonly kind = signal<CategoryKind>('Expense');
  protected readonly breakdown = signal<Breakdown>({ total: 0, shares: [] });
  private readonly yearTotals = signal<MonthTotals[]>([]);

  /** Gli archi della ciambella: le categorie più pesanti, e le restanti riunite in "Altro". */
  protected readonly slices = computed<Slice[]>(() => {
    const { total, shares } = this.breakdown();
    const shown = shares.length > maxSlices ? shares.slice(0, maxSlices - 1) : shares;
    const rest = shares.slice(shown.length).reduce((sum, share) => sum + share.total, 0);
    const parts = rest ? [...shown, { name: 'Altre categorie', total: rest }] : shown;

    let start = 0;
    return parts.map((part, index) => {
      const length = (part.total / total) * circumference;
      const slice = {
        name: part.name,
        total: part.total,
        color: seriesColor(index + 1),
        // Anche una quota minuscola resta visibile come un punto.
        dash: `${Math.max(length - sliceGap, 0.5)} ${circumference}`,
        offset: -start,
      };
      start += length;
      return slice;
    });
  });

  /** Le barre dei dodici mesi, in scala sul valore più alto dell'anno. */
  protected readonly yearBars = computed<YearBar[]>(() => {
    const max = Math.max(1, ...this.yearTotals().flatMap((totals) => [totals.income, totals.expense]));
    const bar = (value: number) => {
      const height = (value / max) * (chartHeight - 4);
      return { y: chartHeight - height, height };
    };
    return this.yearTotals().map((totals) => ({
      label: monthLabel(totals.month),
      x: (totals.month - 1) * monthWidth + (monthWidth - 2 * barWidth - 2) / 2,
      income: bar(totals.income),
      expense: bar(totals.expense),
      totals,
    }));
  });

  constructor() {
    void this.load();
  }

  /** Colore della riga in elenco: quello del suo arco, o quello di "Altro" per le categorie che vi confluiscono. */
  protected colorOf(index: number): string {
    const grouped = this.breakdown().shares.length > maxSlices;
    return seriesColor(grouped ? Math.min(index + 1, maxSlices) : index + 1);
  }

  protected show(period: Period): Promise<void> {
    this.period.set(period);
    return this.load();
  }

  protected showKind(kind: CategoryKind): Promise<void> {
    this.kind.set(kind);
    return this.load();
  }

  private async load(): Promise<void> {
    const { year, month } = this.period();
    const [breakdown, yearTotals] = await Promise.all([
      firstValueFrom(this.http.get<Breakdown>('/api/stats/categories', { params: { year, month, kind: this.kind() } })),
      this.movements.year(year),
    ]);
    this.breakdown.set(breakdown);
    this.yearTotals.set(yearTotals);
  }
}
