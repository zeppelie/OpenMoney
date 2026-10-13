import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Account, AccountsService } from '../accounts/accounts.service';
import { CategoriesService, Category, categoryLabels } from '../categories/categories.service';
import { MovementDialog, MovementDialogData } from '../movements/movement-dialog';
import { movementTitle } from '../movements/movements.service';
import { formDialog } from '../shared/dialogs';
import { EurPipe } from '../shared/money';
import { Recurrence, RecurrencesService, frequencies } from './recurrences.service';

const longDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** I movimenti che si ripetono e i piani di rate: si creano dal modulo di un movimento, scegliendo "Ripeti". */
@Component({
  selector: 'app-recurrences',
  imports: [EurPipe, MatCardModule],
  template: `
    <main class="page">
      <h1>Ricorrenze e rate</h1>

      <mat-card appearance="outlined">
        @for (recurrence of recurrences(); track recurrence.id) {
          <button type="button" class="row" (click)="open(recurrence)">
            <span class="what">
              <span>{{ title(recurrence) }}</span>
              <span class="muted">{{ details(recurrence) }}</span>
            </span>
            <span [class]="recurrence.movement.kind.toLowerCase()">{{ recurrence.movement.amount | eur }}</span>
          </button>
        } @empty {
          <p class="muted empty">
            Nessuna ricorrenza. Per crearne una inserisci un movimento e scegli ogni quanto ripeterlo; con un numero di
            volte diventa un piano di rate.
          </p>
        }
      </mat-card>
    </main>
  `,
  styles: `
    .row:first-child {
      border-top: 0;
    }

    .what {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .what .muted {
      font: var(--mat-sys-body-small);
    }

    .empty {
      padding: 1rem;
    }
  `,
})
export class Recurrences {
  private readonly service = inject(RecurrencesService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);

  protected readonly recurrences = signal<Recurrence[]>([]);
  private readonly accounts = signal<Account[]>([]);
  private readonly categories = signal<Category[]>([]);

  private readonly accountNames = computed(() => new Map(this.accounts().map((account) => [account.id, account.name])));
  private readonly categoryNames = computed(() => categoryLabels(this.categories()));

  constructor() {
    void this.load();
  }

  protected title(recurrence: Recurrence): string {
    return movementTitle(recurrence.movement, this.accountNames(), this.categoryNames());
  }

  /** Nota, frequenza, a che punto è e quando tocca alla prossima. */
  protected details({ movement, frequency, occurrences, generatedCount, nextDate }: Recurrence): string {
    const every = frequencies.find((item) => item.frequency === frequency)?.label;
    const progress = occurrences ? `${generatedCount} di ${occurrences}` : null;
    const next = nextDate ? `prossima il ${longDate.format(new Date(`${nextDate}T00:00`))}` : 'terminata';
    return [movement.note, every, progress, next].filter(Boolean).join(' · ');
  }

  protected async open(recurrence: Recurrence): Promise<void> {
    const data: MovementDialogData = {
      movement: null,
      recurrence,
      date: recurrence.movement.date,
      accounts: this.accounts(),
      categories: this.categories(),
    };
    if (await firstValueFrom(this.dialog.open(MovementDialog, formDialog(data)).afterClosed())) await this.load();
  }

  private async load(): Promise<void> {
    const [recurrences, overview, categories] = await Promise.all([
      this.service.list(),
      this.accountsService.list(),
      this.categoriesService.list(),
    ]);
    this.recurrences.set(recurrences);
    this.accounts.set(overview.accounts);
    this.categories.set(categories);
  }
}
