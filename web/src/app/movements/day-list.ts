import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Account } from '../accounts/accounts.service';
import { Category, categoryLabels } from '../categories/categories.service';
import { Icon } from '../layout/icon';
import { EurPipe } from '../shared/money';
import { DayLedger, Movement, movementTitle } from './movements.service';

const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Il registro: movimenti raggruppati per giorno, dal più recente, su un unico foglio come un quaderno dei conti.
 * Ogni riga porta l'iniziale di chi l'ha inserita; toccandola si chiede di aprirla.
 */
@Component({
  selector: 'app-day-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EurPipe, Icon],
  template: `
    @if (days().length) {
      <div class="ledger">
        @for (day of days(); track day.date) {
          <section [attr.aria-label]="dayLabel(day)">
            <header>
              <span class="date">{{ dayLabel(day) }}</span>
              <span class="day-totals amount">
                @if (day.income) {
                  <span class="income">+{{ day.income | eur }}</span>
                }
                @if (day.expense) {
                  <span>−{{ day.expense | eur }}</span>
                }
              </span>
            </header>
            @for (movement of day.movements; track movement.id) {
              <button type="button" class="entry" (click)="opened.emit(movement)">
                <span class="who" [attr.title]="movement.author ?? 'Inserito dall\\'app'" aria-hidden="true">
                  {{ initial(movement) }}
                </span>
                <span class="what">
                  <span class="title">
                    {{ title(movement) }}
                    @if (movement.attachments.length) {
                      <app-icon name="attach" class="clip" />
                      <span class="sr-only">, con allegati</span>
                    }
                  </span>
                  @if (movement.note) {
                    <span class="note">{{ movement.note }}</span>
                  }
                </span>
                <span class="how">
                  <span class="amount sum" [class.income]="movement.kind === 'Income'" [class.transfer]="movement.kind === 'Transfer'">
                    {{ sign(movement) }}{{ movement.amount | eur }}
                  </span>
                  <span class="account">{{ account(movement) }}</span>
                </span>
              </button>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .ledger {
      overflow: clip;
      background: var(--om-carta);
      border-radius: var(--om-radius-sheet);
    }

    // L'intestazione del giorno resta in vista scorrendo i suoi movimenti.
    header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.875rem 1.25rem 0.375rem;
      background: var(--om-carta);
    }

    section + section header {
      border-top: 1px solid var(--om-filo);
    }

    .date {
      font: 600 1.0625rem/1.3 var(--om-display);
    }

    .date::first-letter {
      text-transform: uppercase;
    }

    .date {
      display: inline-block;
    }

    .day-totals {
      display: flex;
      gap: 0.875rem;
      color: var(--om-grafite);
      font-size: 0.875rem;
    }

    .entry {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.875rem;
      width: 100%;
      padding: 0.625rem 1.25rem;
      color: inherit;
      font: inherit;
      text-align: left;
      background: none;
      border: 0;
      cursor: pointer;
    }

    .entry:hover {
      background: color-mix(in srgb, var(--om-rosa) 55%, transparent);
    }

    .who {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      color: var(--om-rosso);
      font: 600 0.9375rem/1 var(--om-display);
      background: var(--om-rosa);
      border-radius: 50%;
    }

    .what,
    .how {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .how {
      align-items: flex-end;
    }

    .title {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-weight: 600;
    }

    .clip {
      width: 1rem;
      height: 1rem;
      color: var(--om-grafite);
    }

    .note,
    .account {
      overflow: hidden;
      color: var(--om-grafite);
      font-size: 0.875rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sum {
      font-weight: 600;
    }

    .transfer {
      color: var(--om-grafite);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    @media (max-width: 599.98px) {
      header,
      .entry {
        padding-inline: 1rem;
      }

      .entry {
        gap: 0.75rem;
      }
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

  /** Le uscite con il meno, le entrate con il più; un trasferimento non cambia il totale della famiglia. */
  protected sign(movement: Movement): string {
    return movement.kind === 'Expense' ? '−' : movement.kind === 'Income' ? '+' : '';
  }

  /** Iniziale di chi l'ha inserito; € per i movimenti creati dall'app (gli addebiti delle carte). */
  protected initial(movement: Movement): string {
    return movement.author?.charAt(0).toUpperCase() ?? '€';
  }

  protected account(movement: Movement): string {
    return movement.kind === 'Transfer' ? 'Trasferimento' : (this.accountNames().get(movement.accountId) ?? '');
  }
}
