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
    :host {
      display: grid;
      gap: 1.25rem;
      padding: 1rem 1.25rem 1.5rem;
      color: var(--om-on-salvadanaio);
      background: var(--om-salvadanaio);
      border-radius: 28px;
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: -0.5rem;
    }

    // I pulsanti di Material prendono il colore del testo della fascia, non il rosso del tema.
    .nav ::ng-deep .mat-mdc-icon-button {
      --mat-icon-button-icon-color: currentColor;
      color: inherit;
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

    // Sul telefono la fascia arriva ai bordi dello schermo e si chiude in basso.
    @media (max-width: 599.98px) {
      :host {
        margin: -1rem -0.75rem 0;
        padding: calc(0.75rem + env(safe-area-inset-top)) 1rem 1.25rem;
        border-radius: 0 0 28px 28px;
      }

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
