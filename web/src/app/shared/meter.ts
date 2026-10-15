import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Quanto di una disponibilità è già andato: le uscite rispetto alle entrate, la spesa rispetto al budget.
 * Prende il colore del testo intorno (bianco sulla fascia rossa, inchiostro su un foglio); oltre il 100 % il
 * riempimento diventa a righe. Il valore in cifre lo scrive chi lo usa: la barra da sola non basta.
 */
@Component({
  selector: 'app-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'meter',
    'aria-valuemin': '0',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuenow]': 'value()',
    '[class.over]': 'over()',
  },
  template: `<span class="fill" [style.width.%]="percent()"></span>`,
  styles: `
    :host {
      display: block;
      height: 0.625rem;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 999px;
    }

    .fill {
      display: block;
      height: 100%;
      background: currentColor;
      border-radius: inherit;
      transition: width 400ms ease-out;
    }

    :host(.over) .fill {
      background: repeating-linear-gradient(
        135deg,
        currentColor 0 6px,
        color-mix(in srgb, currentColor 55%, transparent) 6px 12px
      );
    }
  `,
})
export class Meter {
  readonly value = input.required<number>();
  readonly max = input.required<number>();

  protected readonly over = computed(() => this.value() > this.max());
  protected readonly percent = computed(() => (this.max() > 0 ? Math.min(100, (this.value() / this.max()) * 100) : 0));
}
