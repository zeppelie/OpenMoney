import { Pipe, PipeTransform } from '@angular/core';

// In italiano il punto delle migliaia di serie compare solo da 10.000: qui serve sempre.
const format = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });

/** Importo in euro alla maniera italiana: 1.234,50 €. */
@Pipe({ name: 'eur' })
export class EurPipe implements PipeTransform {
  transform(amount: number): string {
    return format.format(amount);
  }
}
