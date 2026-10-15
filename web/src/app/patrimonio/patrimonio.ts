import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../layout/icon';
import { EurPipe } from '../shared/money';
import { HoldingSummary, PatrimonioService, SnapshotSummary, SnapshotTotals } from './patrimonio.service';

const longDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });
const percent = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const eur = new EurPipe();

const chartWidth = 640;
const chartHeight = 180;

/**
 * La fotografia del patrimonio, come il foglio "Generale": il gestito per gestore più i conti fa il totale; a parte
 * la previdenza e il mutuo. Si sceglie la rilevazione da guardare; in alto l'andamento del totale nel tempo.
 */
@Component({
  selector: 'app-patrimonio',
  imports: [EurPipe, Icon, MatButtonModule, MatCardModule, RouterLink],
  template: `
    <main class="page">
      <section class="band">
        <div class="head">
          <h1>Patrimonio</h1>
          <span class="spacer"></span>
          @if (history().length) {
            <select class="picker" [value]="selected()?.id" (change)="select($any($event.target).value)" aria-label="Rilevazione da mostrare">
              @for (item of historyNewestFirst(); track item.id) {
                <option [value]="item.id">{{ dateLabel(item.date) }}</option>
              }
            </select>
          }
        </div>
        @if (selected(); as s) {
          <p class="band-figure">
            <strong>{{ s.total | eur }}</strong>
            <span>tra investimenti e conti al {{ dateLabel(s.date) }}</span>
          </p>
          <p>{{ change() }}</p>
          <p class="net">
            Con la previdenza e tolto il mutuo: <strong class="amount">{{ s.netWorth | eur }}</strong>
          </p>
        } @else if (loaded()) {
          <p>Ancora nessuna rilevazione. Prima crea i gestori e le posizioni, poi fai la prima fotografia del patrimonio.</p>
        }
      </section>

      @if (missingThisMonth()) {
        <p class="reminder">
          La rilevazione di {{ thisMonth }} non è ancora fatta.
          <a routerLink="/patrimonio/rilevazione">Falla adesso</a>
        </p>
      }

      @if (trend(); as t) {
        <mat-card appearance="outlined" class="chart">
          <h2>Andamento del totale</h2>
          <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + (chartHeight + 24)" role="img" aria-label="Totale di investimenti e conti a ogni rilevazione">
            <text x="0" y="10" class="tick">{{ t.max | eur }}</text>
            <text x="0" [attr.y]="chartHeight" class="tick">{{ t.min | eur }}</text>
            <path [attr.d]="t.area" class="area" />
            <path [attr.d]="t.line" class="line" />
            @for (point of t.points; track point.id) {
              <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4" class="dot" [class.current]="point.id === selected()?.id" (click)="select(point.id)">
                <title>{{ dateLabel(point.date) }}: {{ point.total | eur }}</title>
              </circle>
            }
            <text [attr.x]="t.points[0].x" [attr.y]="chartHeight + 20" class="tick">{{ short(t.points[0].date) }}</text>
            <text [attr.x]="t.points[t.points.length - 1].x" [attr.y]="chartHeight + 20" class="tick end">
              {{ short(t.points[t.points.length - 1].date) }}
            </text>
          </svg>
        </mat-card>
      }

      @if (selected(); as s) {
        <mat-card appearance="outlined">
          <div class="row head section">
            <h2>Investimenti</h2>
            <span class="amount">{{ s.managed | eur }}</span>
          </div>
          @for (portfolio of s.portfolios; track portfolio.portfolioId) {
            <div class="row portfolio">
              <span>{{ portfolio.name }}</span>
              <span class="figures">
                <span class="amount">{{ portfolio.value | eur }}</span>
                <span class="gain amount" [class.income]="(portfolio.gain ?? 0) > 0" [class.negative]="(portfolio.gain ?? 0) < 0">
                  {{ gain(portfolio.gainPercent) }}
                </span>
              </span>
            </div>
            @for (holding of portfolio.holdings; track holding.holdingId) {
              <div class="row holding">
                <span class="name">{{ holding.name }}</span>
                <span class="figures">
                  <span class="amount muted">{{ invested(holding) }}</span>
                  <span class="amount">{{ holding.value | eur }}</span>
                  <span class="gain amount" [class.income]="(holding.gain ?? 0) > 0" [class.negative]="(holding.gain ?? 0) < 0">
                    {{ gain(holding.gainPercent) }}
                  </span>
                </span>
              </div>
            }
          } @empty {
            <p class="muted empty">Nessun investimento in questa rilevazione.</p>
          }
        </mat-card>

        <mat-card appearance="outlined">
          <div class="row head section">
            <h2>Conti</h2>
            <span class="amount">{{ s.liquidity | eur }}</span>
          </div>
          @for (account of s.accounts; track account.name) {
            <div class="row">
              <span>{{ account.name }}</span>
              <span class="amount" [class.negative]="account.balance < 0">{{ account.balance | eur }}</span>
            </div>
          }
        </mat-card>

        @if (s.pension.length) {
          <mat-card appearance="outlined">
            <div class="row head section">
              <h2>Previdenza</h2>
              <span class="amount">{{ s.pensionTotal | eur }}</span>
            </div>
            <p class="muted explain">Non prelevabile: resta fuori dal totale.</p>
            @for (holding of s.pension; track holding.holdingId) {
              <div class="row">
                <span>{{ holding.name }}</span>
                <span class="amount">{{ holding.value | eur }}</span>
              </div>
            }
          </mat-card>
        }

        @if (s.debts.length) {
          <mat-card appearance="outlined">
            <div class="row head section">
              <h2>Mutuo e debiti</h2>
              <span class="amount">{{ s.debtTotal | eur }}</span>
            </div>
            <p class="muted explain">Quanto resta da pagare: si toglie dal patrimonio netto.</p>
            @for (holding of s.debts; track holding.holdingId) {
              <div class="row">
                <span>{{ holding.name }}</span>
                <span class="amount">{{ holding.value | eur }}</span>
              </div>
            }
          </mat-card>
        }

        @if (s.note) {
          <p class="muted">{{ s.note }}</p>
        }
      }

      <div class="actions">
        @if (selected(); as s) {
          <a matButton="outlined" [routerLink]="['/patrimonio/rilevazione', s.id]">Modifica questa rilevazione</a>
        }
        <a matButton routerLink="/patrimonio/posizioni">Gestori e posizioni</a>
      </div>

      <a matFab extended class="fab" routerLink="/patrimonio/rilevazione">
        <app-icon name="add" />
        Rilevazione
      </a>
    </main>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .picker {
      max-width: 12rem;
      padding: 0.375rem 0.625rem;
      color: inherit;
      font: inherit;
      background: color-mix(in srgb, currentColor 14%, transparent);
      border: 0;
      border-radius: 10px;
    }

    .picker option {
      color: var(--om-inchiostro);
      background: var(--om-carta);
    }

    .net strong {
      font-weight: 600;
    }

    .reminder {
      margin: 0;
      padding: 0.875rem 1.25rem;
      background: var(--om-rosa);
      border-radius: var(--om-radius-sheet);
    }

    .chart {
      padding: 1.25rem;
    }

    .chart svg {
      width: 100%;
      margin-top: 0.75rem;
    }

    .area {
      fill: color-mix(in srgb, var(--om-verderame) 14%, transparent);
    }

    .line {
      fill: none;
      stroke: var(--om-verderame);
      stroke-width: 2;
    }

    .dot {
      fill: var(--om-carta);
      stroke: var(--om-verderame);
      stroke-width: 2;
      cursor: pointer;
    }

    .dot.current {
      fill: var(--om-verderame);
    }

    .tick {
      font-size: 11px;
      fill: var(--om-grafite);
    }

    .tick.end {
      text-anchor: end;
    }

    .section h2 {
      font-size: 1.125rem;
    }

    .portfolio {
      font-weight: 600;
      background: color-mix(in srgb, var(--om-rosa) 40%, transparent);
    }

    .holding .name {
      min-width: 0;
      padding-left: 0.75rem;
      overflow-wrap: anywhere;
    }

    .figures {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0 1.25rem;
    }

    .gain {
      min-width: 4.5rem;
      text-align: right;
    }

    .explain,
    .empty {
      margin: 0;
      padding: 0 1.25rem 0.75rem;
      font-size: 0.875rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class Patrimonio {
  private readonly service = inject(PatrimonioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly chartWidth = chartWidth;
  protected readonly chartHeight = chartHeight;
  protected readonly thisMonth = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date());

  protected readonly history = signal<SnapshotTotals[]>([]);
  protected readonly selected = signal<SnapshotSummary | null>(null);
  protected readonly loaded = signal(false);

  protected readonly historyNewestFirst = computed(() => [...this.history()].reverse());

  /** Di quanto è cambiato il totale rispetto alla rilevazione precedente a quella mostrata. */
  protected readonly change = computed(() => {
    const current = this.selected();
    const history = this.history();
    const index = history.findIndex((item) => item.id === current?.id);
    if (!current || index < 1) return 'È la prima rilevazione.';
    const previous = history[index - 1];
    const delta = current.total - previous.total;
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    return `${sign}${eur.transform(Math.abs(delta))} rispetto al ${this.dateLabel(previous.date)}.`;
  });

  /** Vero se nel mese in corso non c'è ancora una rilevazione (solo quando ce n'è almeno una prima). */
  protected readonly missingThisMonth = computed(() => {
    const last = this.history().at(-1);
    const today = new Date();
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return !!last && !last.date.startsWith(thisMonth);
  });

  /** La linea del totale: servono almeno due rilevazioni. */
  protected readonly trend = computed(() => {
    const history = this.history();
    if (history.length < 2) return null;

    const totals = history.map((item) => item.total);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const span = max - min || 1;
    const left = 70;
    const top = 16;
    const step = (chartWidth - left - 8) / (history.length - 1);
    const points = history.map((item, index) => ({
      id: item.id,
      date: item.date,
      total: item.total,
      x: left + index * step,
      y: top + (1 - (item.total - min) / span) * (chartHeight - top - 8),
    }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${points.at(-1)!.x.toFixed(1)},${chartHeight} L${left},${chartHeight} Z`;
    return { min, max, points, line, area };
  });

  constructor() {
    void this.load();
  }

  protected dateLabel(date: string): string {
    return longDate.format(new Date(`${date}T00:00`));
  }

  protected short(date: string): string {
    return shortDate.format(new Date(`${date}T00:00`));
  }

  protected gain(value: number | null): string {
    return value === null ? '' : `${percent.format(value)} %`;
  }

  protected invested(holding: HoldingSummary): string {
    return holding.invested === null ? '' : `investiti ${eur.transform(holding.invested)}`;
  }

  protected async select(id: string): Promise<void> {
    await this.router.navigate([], { queryParams: { id }, replaceUrl: true });
    this.selected.set(await this.service.snapshot(id));
  }

  private async load(): Promise<void> {
    const history = await this.service.snapshots();
    this.history.set(history);
    this.loaded.set(true);
    const requested = this.route.snapshot.queryParamMap.get('id');
    const id = history.some((item) => item.id === requested) ? requested : history.at(-1)?.id;
    if (id) this.selected.set(await this.service.snapshot(id));
  }
}
