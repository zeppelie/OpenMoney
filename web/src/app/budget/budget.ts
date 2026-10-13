import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';
import { MonthNav } from '../shared/month-nav';
import { Period, currentPeriod } from '../shared/period';
import { BudgetDialog } from './budget-dialog';
import { BudgetLine, BudgetService, BudgetStatus } from './budget.service';

/** Quanto si è speso nel mese rispetto al budget di ogni categoria di uscita. */
@Component({
  selector: 'app-budget',
  imports: [EurPipe, MatCardModule, MonthNav],
  template: `
    <main class="page">
      <app-month-nav [period]="period()" (periodChange)="show($event)" />

      @if (status(); as status) {
        <mat-card appearance="outlined">
          <div class="totals">
            <span>Budget <strong>{{ status.budget | eur }}</strong></span>
            <span>Speso <strong>{{ status.spent | eur }}</strong></span>
            <span>
              {{ status.remaining < 0 ? 'Sforato di' : 'Rimane' }}
              <strong [class.expense]="status.remaining < 0">{{ abs(status.remaining) | eur }}</strong>
            </span>
          </div>
        </mat-card>

        <mat-card appearance="outlined">
          @for (line of status.lines; track line.categoryId) {
            <button type="button" class="row line" (click)="open(line)">
              <span class="top">
                <span>{{ line.name }}</span>
                @if (line.budget !== null) {
                  <span>{{ line.spent | eur }} di {{ line.budget | eur }}</span>
                } @else {
                  <span class="muted">{{ line.spent | eur }} · nessun budget</span>
                }
              </span>
              @if (line.budget !== null && line.remaining !== null) {
                <span class="meter" [class.over]="line.remaining < 0">
                  <span [style.width.%]="percent(line)"></span>
                </span>
                <span class="muted small" [class.expense]="line.remaining < 0">
                  {{ line.remaining < 0 ? 'Sforato di' : 'Rimangono' }} {{ abs(line.remaining) | eur }}
                </span>
              }
            </button>
          } @empty {
            <p class="muted empty">Non ci sono categorie di uscita.</p>
          }
        </mat-card>
      }
    </main>
  `,
  styles: `
    .line {
      flex-direction: column;
      align-items: stretch;
      gap: 0.35rem;
    }

    .line:first-child {
      border-top: 0;
    }

    .top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0 1rem;
    }

    // Barra di avanzamento: stessa tinta per fondo e riempimento, più tenue il fondo.
    .meter {
      height: 0.5rem;
      overflow: hidden;
      background: var(--mat-sys-surface-container-highest);
      border-radius: 0.25rem;
    }

    .meter span {
      display: block;
      height: 100%;
      // Blu, non il rosso del tema: il rosso qui vuol dire "sforato".
      background: light-dark(#2a78d6, #3987e5);
      border-radius: 0.25rem;
    }

    .meter.over span {
      background: var(--mat-sys-error);
    }

    .small {
      font: var(--mat-sys-body-small);
    }

    .empty {
      padding: 1rem;
    }
  `,
})
export class Budget {
  private readonly budgets = inject(BudgetService);
  private readonly dialog = inject(MatDialog);
  protected readonly abs = Math.abs;

  protected readonly period = signal(currentPeriod());
  protected readonly status = signal<BudgetStatus | null>(null);

  constructor() {
    void this.load();
  }

  /** Quota di budget consumata, fermata al 100 %: lo sforamento lo dice il testo sotto la barra. */
  protected percent(line: BudgetLine): number {
    return line.budget ? Math.min(100, (line.spent / line.budget) * 100) : 0;
  }

  protected show(period: Period): Promise<void> {
    this.period.set(period);
    return this.load();
  }

  protected async open(line: BudgetLine): Promise<void> {
    if (await firstValueFrom(this.dialog.open(BudgetDialog, formDialog(line)).afterClosed())) await this.load();
  }

  private async load(): Promise<void> {
    const { year, month } = this.period();
    this.status.set(await this.budgets.status(year, month));
  }
}
