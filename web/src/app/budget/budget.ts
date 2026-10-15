import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { formDialog } from '../shared/dialogs';
import { Meter } from '../shared/meter';
import { EurPipe } from '../shared/money';
import { MonthNav } from '../shared/month-nav';
import { Period, currentPeriod } from '../shared/period';
import { BudgetDialog } from './budget-dialog';
import { BudgetLine, BudgetService, BudgetStatus } from './budget.service';

/** Quanto si è speso nel mese rispetto al budget di ogni categoria di uscita. */
@Component({
  selector: 'app-budget',
  imports: [EurPipe, MatCardModule, Meter, MonthNav],
  template: `
    <main class="page">
      <app-month-nav [period]="period()" (periodChange)="show($event)">
        @if (status(); as status) {
          @if (status.budget) {
            <div class="summary">
              <p class="figures">
                <strong class="amount">{{ status.spent | eur }}</strong>
                <span>spesi su {{ status.budget | eur }} di budget</span>
              </p>
              <app-meter [value]="status.spent" [max]="status.budget" aria-label="Spesa rispetto al budget" />
              <p>
                {{ status.remaining < 0 ? 'Budget sforato di' : 'Restano' }} {{ abs(status.remaining) | eur }}.
              </p>
            </div>
          } @else {
            <p>Nessun budget impostato: tocca una categoria per dargliene uno.</p>
          }
        }
      </app-month-nav>

      @if (status(); as status) {
        <mat-card appearance="outlined">
          @for (line of status.lines; track line.categoryId) {
            <button type="button" class="row line" (click)="open(line)">
              <span class="top">
                <span class="name">{{ line.name }}</span>
                @if (line.budget !== null) {
                  <span class="amount">{{ line.spent | eur }} <span class="muted">di {{ line.budget | eur }}</span></span>
                } @else {
                  <span class="amount muted">{{ line.spent | eur }}</span>
                }
              </span>
              @if (line.budget !== null && line.remaining !== null) {
                <app-meter [class.negative]="line.remaining < 0" [value]="line.spent" [max]="line.budget" [attr.aria-label]="'Spesa di ' + line.name" />
                <span class="muted small" [class.negative]="line.remaining < 0">
                  {{ line.remaining < 0 ? 'Sforato di' : 'Restano' }} {{ abs(line.remaining) | eur }}
                </span>
              } @else {
                <span class="muted small">Senza budget</span>
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
    .summary {
      display: grid;
      gap: 0.75rem;
    }

    p {
      margin: 0;
      font-weight: 500;
    }

    .figures {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
      font-weight: 400;
    }

    .figures strong {
      font: 600 1.75rem/1.15 var(--om-display);
    }

    .line {
      flex-direction: column;
      align-items: stretch;
      gap: 0.4rem;
      padding-block: 0.875rem;
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

    .name {
      font-weight: 600;
    }

    // Nei fogli la barra è in inchiostro; diventa rossa solo quando il budget è sforato.
    .line app-meter {
      height: 0.5rem;
      color: var(--om-inchiostro);
    }

    .line app-meter.negative {
      color: var(--om-rosso);
    }

    .small {
      font-size: 0.8125rem;
    }

    .empty {
      padding: 1.25rem;
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
