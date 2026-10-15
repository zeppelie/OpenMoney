import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EurPipe } from './money';
import { Meter } from './meter';

const eur = new EurPipe();
const percent = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

/**
 * Entrate e uscite di un periodo, con la barra di quanto delle entrate è già uscito e una frase che dice come va.
 * Prende il colore del testo intorno: bianco sulla fascia del mese, inchiostro su un foglio.
 */
@Component({
  selector: 'app-month-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EurPipe, Meter],
  template: `
    <div class="figures">
      <span>Entrate <strong class="amount">{{ income() | eur }}</strong></span>
      <span>Uscite <strong class="amount">{{ expense() | eur }}</strong></span>
    </div>
    @if (income() > 0) {
      <app-meter [value]="expense()" [max]="income()" aria-label="Uscite rispetto alle entrate" />
    }
    <p>{{ verdict() }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }

    .figures {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 2.5rem;
    }

    .figures span {
      display: flex;
      flex-direction: column;
      font-size: 0.875rem;
      opacity: 0.85;
    }

    strong {
      font: 600 1.75rem/1.15 var(--om-display);
      opacity: 1;
    }

    p {
      margin: 0;
      font-weight: 500;
    }

    @media (max-width: 599.98px) {
      strong {
        font-size: 1.5rem;
      }
    }
  `,
})
export class MonthSummary {
  readonly income = input.required<number>();
  readonly expense = input.required<number>();

  protected readonly verdict = computed(() => {
    const income = this.income();
    const expense = this.expense();
    if (!income && !expense) return 'Ancora nessuna entrata né uscita.';
    if (!income) return `Nessuna entrata, uscite per ${eur.transform(expense)}.`;
    if (expense > income) return `Le uscite superano le entrate di ${eur.transform(expense - income)}.`;
    return `Restano ${eur.transform(income - expense)}: è uscito il ${percent.format((expense / income) * 100)} % delle entrate.`;
  });
}
