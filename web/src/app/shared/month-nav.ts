import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from '../layout/icon';
import { Period, monthLabel, shiftPeriod } from './period';

/** Titolo della pagina con il mese mostrato e le frecce per passare al precedente o al successivo. */
@Component({
  selector: 'app-month-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MatButtonModule],
  template: `
    <button matIconButton type="button" (click)="shift(-1)" aria-label="Mese precedente">
      <app-icon name="chevronLeft" />
    </button>
    <h1>{{ title() }}</h1>
    <button matIconButton type="button" (click)="shift(1)" aria-label="Mese successivo">
      <app-icon name="chevronRight" />
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    h1 {
      min-width: 11rem;
      margin: 0;
      text-align: center;
      text-transform: capitalize;
    }
  `,
})
export class MonthNav {
  readonly period = input.required<Period>();
  readonly periodChange = output<Period>();

  protected readonly title = computed(() => `${monthLabel(this.period().month)} ${this.period().year}`);

  protected shift(months: number): void {
    this.periodChange.emit(shiftPeriod(this.period(), months));
  }
}
