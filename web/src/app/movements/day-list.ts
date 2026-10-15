import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Account } from '../accounts/accounts.service';
import { Category, categoryLabels } from '../categories/categories.service';
import { Icon } from '../layout/icon';
import { EurPipe } from '../shared/money';
import { DayLedger, Movement, movementTitle } from './movements.service';

const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Elenco di movimenti raggruppati per giorno, dal più recente; toccandone uno si chiede di aprirlo. */
@Component({
  selector: 'app-day-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EurPipe, Icon, MatCardModule],
  template: `
    @for (day of days(); track day.date) {
      <mat-card appearance="outlined">
        <div class="row head">
          <span class="date">{{ dayLabel(day) }}</span>
          <span class="amounts">
            <span class="income">{{ day.income | eur }}</span>
            <span class="expense">{{ day.expense | eur }}</span>
          </span>
        </div>
        @for (movement of day.movements; track movement.id) {
          <button type="button" class="row" (click)="opened.emit(movement)">
            <span class="what">
              <span class="title">
                {{ title(movement) }}
                @if (movement.attachments.length) {
                  <app-icon name="attach" class="clip" [attr.title]="movement.attachments.length + ' allegati'" />
                }
              </span>
              <span class="muted">{{ details(movement) }}</span>
            </span>
            <span [class]="movement.kind.toLowerCase()">{{ movement.amount | eur }}</span>
          </button>
        }
      </mat-card>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }

    // Maiuscola solo all'inizio: in italiano i mesi restano minuscoli.
    .date {
      display: inline-block;
    }

    .date::first-letter {
      text-transform: uppercase;
    }

    .what {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .title {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .clip {
      width: 1rem;
      height: 1rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .what .muted {
      font: var(--mat-sys-body-small);
    }

    .amounts {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0 1rem;
    }
  `,
})
export class DayList {
  readonly days = input.required<DayLedger[]>();
  readonly accounts = input.required<Account[]>();
  readonly categories = input.required<Category[]>();
  readonly opened = output<Movement>();

  private readonly accountNames = computed(() => new Map(this.accounts().map((account) => [account.id, account.name])));
  private readonly categoryNames = computed(() => categoryLabels(this.categories()));

  protected dayLabel(day: DayLedger): string {
    return dayName.format(new Date(`${day.date}T00:00`));
  }

  protected title(movement: Movement): string {
    return movementTitle(movement, this.accountNames(), this.categoryNames());
  }

  /** Seconda riga: nota, conto e chi l'ha inserito. */
  protected details(movement: Movement): string {
    const account = movement.kind === 'Transfer' ? 'Trasferimento' : this.accountNames().get(movement.accountId);
    return [movement.note, account, movement.author].filter(Boolean).join(' · ');
  }
}
