import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from '../layout/icon';
import { Period, monthLabel, shiftPeriod } from './period';

/**
 * La fascia rossa in cima alle pagine che si sfogliano per mese: il mese con le frecce e, sotto, il riepilogo che
 * la pagina vi mette dentro. È l'unico grande campo di rosso dell'app, come il salvadanaio dell'icona.
 */
@Component({
  selector: 'app-month-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // L'aspetto della fascia sta negli stili globali (.band): lo usa anche la pagina del patrimonio.
  host: { class: 'band' },
  imports: [Icon, MatButtonModule],
  template: `
    <div class="nav">
      <button matIconButton type="button" (click)="shift(-1)" aria-label="Mese precedente">
        <app-icon name="chevronLeft" />
      </button>
      <h1>
        <span class="month">{{ month() }}</span>
        <span class="year">{{ period().year }}</span>
      </h1>
      <button matIconButton type="button" (click)="shift(1)" aria-label="Mese successivo">
        <app-icon name="chevronRight" />
      </button>
      <span class="spacer"></span>
      <ng-content select="[band-action]" />
    </div>
    <ng-content />
  `,
  styles: `
    .nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: -0.5rem;
    }

    h1 {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      min-width: 12rem;
    }

    .month::first-letter {
      text-transform: uppercase;
    }

    .month {
      display: inline-block;
    }

    .year {
      font-weight: 400;
      opacity: 0.72;
    }

    @media (max-width: 599.98px) {
      h1 {
        min-width: 0;
      }
    }
  `,
})
export class MonthNav {
  readonly period = input.required<Period>();
  readonly periodChange = output<Period>();

  protected readonly month = computed(() => monthLabel(this.period().month));

  protected shift(months: number): void {
    this.periodChange.emit(shiftPeriod(this.period(), months));
  }
}
