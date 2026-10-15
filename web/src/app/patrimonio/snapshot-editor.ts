import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../layout/icon';
import { errorMessages } from '../shared/errors';
import { EurPipe } from '../shared/money';
import { isoDate } from '../shared/period';
import { Holding, PatrimonioService, Portfolio, SnapshotHolding, SnapshotValues } from './patrimonio.service';

interface Line {
  index: number;
  holding: Holding;
  line: SnapshotHolding;
}

/**
 * Il modulo della rilevazione mensile. Una rilevazione nuova parte dai valori della volta prima e dai saldi dei conti
 * calcolati da OpenMoney: di solito basta aggiornare il valore di ogni posizione.
 */
@Component({
  selector: 'app-snapshot-editor',
  imports: [EurPipe, Icon, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, RouterLink],
  template: `
    <main class="page">
      <h1>{{ id ? 'Modifica rilevazione' : 'Nuova rilevazione' }}</h1>

      @if (values(); as v) {
        <mat-card appearance="outlined" class="stack">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date">
            <mat-label>Data</mat-label>
            <input matInput type="date" [value]="v.date" (change)="changeDate($any($event.target).value)" />
            @if (!id) {
              <mat-hint>Cambiando la data si ricalcolano i saldi dei conti di OpenMoney.</mat-hint>
            }
          </mat-form-field>
        </mat-card>

        @for (group of groups(); track group.title) {
          <mat-card appearance="outlined">
            <div class="row head"><h2>{{ group.title }}</h2></div>
            @if (group.hint) {
              <p class="muted hint">{{ group.hint }}</p>
            }
            @for (item of group.lines; track item.holding.id) {
              <div class="line">
                <span class="name">{{ item.holding.name }}</span>
                @if (item.holding.kind === 'Investment') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Investiti (€)</mat-label>
                    <input matInput type="number" step="0.01" min="0" inputmode="decimal" [value]="item.line.invested" (change)="setInvested(item.index, $event)" />
                  </mat-form-field>
                }
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ item.holding.kind === 'Debt' ? 'Residuo (€)' : 'Valore (€)' }}</mat-label>
                  <input matInput type="number" step="0.01" min="0" inputmode="decimal" [value]="item.line.value" (change)="setValue(item.index, $event)" />
                </mat-form-field>
                <button matIconButton type="button" (click)="removeHolding(item.index)" [attr.aria-label]="'Togli ' + item.holding.name">
                  <app-icon name="close" />
                </button>
              </div>
            }
          </mat-card>
        }

        @if (addable().length) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Aggiungi una posizione</mat-label>
            <mat-select (selectionChange)="addHolding($event.value)">
              @for (holding of addable(); track holding.id) {
                <mat-option [value]="holding">{{ holding.name }}{{ holding.closed ? ' (chiusa)' : '' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-card appearance="outlined">
          <div class="row head"><h2>Conti</h2></div>
          <p class="muted hint">
            I saldi dei conti di OpenMoney sono calcolati dai movimenti: correggili se non sono ancora aggiornati.
            Gli altri conti (es. Satispay) si aggiungono a mano e restano per le prossime rilevazioni.
          </p>
          @for (account of v.accounts; track $index) {
            <div class="line">
              @if (account.accountId) {
                <span class="name">{{ account.name }}</span>
              } @else {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="name">
                  <mat-label>Conto</mat-label>
                  <input matInput maxlength="60" [value]="account.name" (change)="setAccountName($index, $event)" />
                </mat-form-field>
              }
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Saldo (€)</mat-label>
                <input matInput type="number" step="0.01" inputmode="decimal" [value]="account.balance" (change)="setBalance($index, $event)" />
              </mat-form-field>
              <button matIconButton type="button" (click)="removeAccount($index)" [attr.aria-label]="'Togli ' + account.name">
                <app-icon name="close" />
              </button>
            </div>
          }
          <div class="row">
            <button matButton type="button" (click)="addAccount()">Aggiungi un conto</button>
            <span class="amount">{{ liquidity() | eur }}</span>
          </div>
        </mat-card>

        <mat-card appearance="outlined" class="stack">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nota</mat-label>
            <textarea matInput rows="2" maxlength="500" [value]="v.note ?? ''" (change)="setNote($event)"></textarea>
          </mat-form-field>
        </mat-card>

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button matButton="filled" type="button" (click)="save()" [disabled]="busy()">Salva rilevazione</button>
          <a matButton routerLink="/patrimonio">Annulla</a>
          <span class="spacer"></span>
          @if (id) {
            <button matButton type="button" (click)="remove()">Elimina</button>
          }
        </div>
      }
    </main>
  `,
  styles: `
    .date {
      max-width: 14rem;
    }

    .hint {
      margin: 0;
      padding: 0 1.25rem 0.5rem;
      font-size: 0.875rem;
    }

    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      padding: 0.5rem 1.25rem;
      border-top: 1px solid var(--om-filo);
    }

    .line mat-form-field {
      width: 9.5rem;
    }

    .line .name {
      flex: 1 1 12rem;
      min-width: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .line mat-form-field.name {
      width: auto;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class SnapshotEditor {
  private readonly service = inject(PatrimonioService);
  private readonly router = inject(Router);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? undefined;

  protected readonly values = signal<SnapshotValues | null>(null);
  private readonly holdings = signal<Holding[]>([]);
  private readonly portfolios = signal<Portfolio[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);

  private readonly byId = computed(() => new Map(this.holdings().map((h) => [h.id, h])));

  /** Le righe raggruppate come nella pagina del patrimonio: per gestore, poi previdenza e debiti. */
  protected readonly groups = computed(() => {
    const lines: Line[] = (this.values()?.holdings ?? [])
      .map((line, index) => ({ index, line, holding: this.byId().get(line.holdingId)! }))
      .filter((item) => item.holding)
      .sort((a, b) => a.holding.name.localeCompare(b.holding.name, 'it'));
    const names = new Map(this.portfolios().map((p) => [p.id, p.name]));

    const investments = [...new Set(lines.filter((l) => l.holding.kind === 'Investment').map((l) => l.holding.portfolioId))]
      .map((portfolioId) => ({
        title: names.get(portfolioId!) ?? 'Investimenti',
        hint: null as string | null,
        lines: lines.filter((l) => l.holding.kind === 'Investment' && l.holding.portfolioId === portfolioId),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'it'));
    const pension = lines.filter((l) => l.holding.kind === 'Pension');
    const debts = lines.filter((l) => l.holding.kind === 'Debt');

    return [
      ...investments,
      ...(pension.length ? [{ title: 'Previdenza', hint: null, lines: pension }] : []),
      ...(debts.length ? [{ title: 'Mutuo e debiti', hint: 'Quanto resta da pagare alla data.', lines: debts }] : []),
    ];
  });

  /** Le posizioni non ancora nella rilevazione: le aperte nuove o, per lo storico, anche le chiuse. */
  protected readonly addable = computed(() => {
    const present = new Set(this.values()?.holdings.map((h) => h.holdingId));
    return this.holdings().filter((h) => !present.has(h.id));
  });

  protected readonly liquidity = computed(() => (this.values()?.accounts ?? []).reduce((sum, a) => sum + (a.balance || 0), 0));

  constructor() {
    void this.load();
  }

  protected async changeDate(date: string): Promise<void> {
    if (!date) return;
    this.update((v) => ({ ...v, date }));
    if (this.id) return;

    // Solo i saldi dei conti di OpenMoney dipendono dalla data; i valori già scritti restano.
    const draft = await this.service.draft(date);
    this.update((v) => ({
      ...v,
      accounts: [...draft.accounts.filter((a) => a.accountId), ...v.accounts.filter((a) => !a.accountId)],
    }));
  }

  protected setInvested(index: number, event: Event): void {
    const invested = this.number(event);
    this.updateHolding(index, { invested });
  }

  protected setValue(index: number, event: Event): void {
    this.updateHolding(index, { value: this.number(event) ?? 0 });
  }

  protected removeHolding(index: number): void {
    this.update((v) => ({ ...v, holdings: v.holdings.filter((_, i) => i !== index) }));
  }

  protected addHolding(holding: Holding): void {
    this.update((v) => ({ ...v, holdings: [...v.holdings, { holdingId: holding.id, invested: null, value: 0 }] }));
  }

  protected setAccountName(index: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.update((v) => ({ ...v, accounts: v.accounts.map((a, i) => (i === index ? { ...a, name } : a)) }));
  }

  protected setBalance(index: number, event: Event): void {
    const balance = this.number(event) ?? 0;
    this.update((v) => ({ ...v, accounts: v.accounts.map((a, i) => (i === index ? { ...a, balance } : a)) }));
  }

  protected removeAccount(index: number): void {
    this.update((v) => ({ ...v, accounts: v.accounts.filter((_, i) => i !== index) }));
  }

  protected addAccount(): void {
    this.update((v) => ({ ...v, accounts: [...v.accounts, { accountId: null, name: '', balance: 0 }] }));
  }

  protected setNote(event: Event): void {
    const note = (event.target as HTMLTextAreaElement).value || null;
    this.update((v) => ({ ...v, note }));
  }

  protected async save(): Promise<void> {
    const values = this.values();
    if (!values) return;
    this.busy.set(true);
    this.errors.set([]);
    try {
      const id = await this.service.save(values, this.id);
      await this.router.navigate(['/patrimonio'], { queryParams: { id } });
    } catch (e) {
      this.errors.set(errorMessages(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (!this.id || !confirm('Eliminare questa rilevazione?')) return;
    try {
      await this.service.remove(this.id);
      await this.router.navigateByUrl('/patrimonio');
    } catch (e) {
      this.errors.set(errorMessages(e));
    }
  }

  private updateHolding(index: number, changes: Partial<SnapshotHolding>): void {
    this.update((v) => ({ ...v, holdings: v.holdings.map((h, i) => (i === index ? { ...h, ...changes } : h)) }));
  }

  private update(change: (values: SnapshotValues) => SnapshotValues): void {
    this.values.update((v) => v && change(v));
  }

  /** Il numero scritto in un campo; null se il campo è vuoto. */
  private number(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  private async load(): Promise<void> {
    const today = new Date();
    const [holdings, portfolios, values] = await Promise.all([
      this.service.holdings(),
      this.service.portfolios(),
      this.id
        ? this.service.values(this.id)
        : this.service.draft(isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())),
    ]);
    this.holdings.set(holdings);
    this.portfolios.set(portfolios);
    this.values.set(values);
  }
}
