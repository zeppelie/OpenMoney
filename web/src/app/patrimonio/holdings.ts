import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Icon } from '../layout/icon';
import { errorMessages } from '../shared/errors';
import { Holding, HoldingKind, PatrimonioService, Portfolio, holdingKinds } from './patrimonio.service';

/** I gestori (Intesa, Azimut, Gestito da me…) e le posizioni di cui si rileva il valore ogni mese. */
@Component({
  selector: 'app-holdings',
  imports: [
    Icon,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <main class="page">
      <h1>Gestori e posizioni</h1>
      <a matButton routerLink="/patrimonio" class="back">Torna al patrimonio</a>

      <mat-card appearance="outlined">
        <div class="row head"><h2>Gestori</h2></div>
        @for (portfolio of portfolios(); track portfolio.id) {
          <div class="row">
            <span>{{ portfolio.name }}</span>
            <span>
              <button matButton type="button" (click)="renamePortfolio(portfolio)">Rinomina</button>
              <button matIconButton type="button" (click)="removePortfolio(portfolio)" [attr.aria-label]="'Elimina ' + portfolio.name">
                <app-icon name="delete" />
              </button>
            </span>
          </div>
        }
        <div class="row">
          <button matButton type="button" (click)="addPortfolio()">Aggiungi un gestore</button>
        </div>
      </mat-card>

      <mat-card appearance="outlined">
        <div class="row head"><h2>Posizioni</h2></div>
        @for (holding of sorted(); track holding.id) {
          <button type="button" class="row" (click)="edit(holding)">
            <span class="what">
              <span>{{ holding.name }}</span>
              <span class="muted small">{{ describe(holding) }}</span>
            </span>
          </button>
        } @empty {
          <p class="muted empty">Nessuna posizione: aggiungi i fondi, gli ETF, il fondo pensione e il mutuo.</p>
        }
      </mat-card>

      <mat-card appearance="outlined">
        <form class="stack" [formGroup]="form" (ngSubmit)="saveHolding()">
          <h2>{{ editing() ? 'Modifica posizione' : 'Nuova posizione' }}</h2>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome</mat-label>
            <input matInput formControlName="name" maxlength="100" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="kind">
              @for (item of kinds; track item.kind) {
                <mat-option [value]="item.kind">{{ item.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (form.controls.kind.value === 'Investment') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Gestore</mat-label>
              <mat-select formControlName="portfolioId">
                @for (portfolio of portfolios(); track portfolio.id) {
                  <mat-option [value]="portfolio.id">{{ portfolio.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
          <mat-checkbox formControlName="closed">Chiusa: non proporla più nelle nuove rilevazioni</mat-checkbox>
          @for (error of errors(); track error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <div class="actions">
            <button matButton="filled" type="submit" [disabled]="form.invalid">Salva posizione</button>
            @if (editing(); as holding) {
              <button matButton type="button" (click)="cancel()">Annulla</button>
              <span class="spacer"></span>
              <button matButton type="button" (click)="removeHolding(holding)">Elimina</button>
            }
          </div>
        </form>
      </mat-card>

      @if (auth.user()?.isAdmin) {
        <mat-card appearance="outlined" class="stack">
          <h2>Importa uno storico</h2>
          <p class="muted">
            Un file JSON di rilevazioni passate (vedi README). Gestori, posizioni e conti mancanti vengono creati; i conti
            nuovi partono dal saldo dell'ultima rilevazione. Le date già presenti si saltano, quindi lo stesso file si può
            importare di nuovo senza doppioni.
          </p>
          <input #picker type="file" accept="application/json,.json" hidden (change)="import($event)" />
          <div class="actions">
            <button matButton="outlined" type="button" (click)="picker.click()" [disabled]="busy()">Scegli il file</button>
          </div>
          @if (importResult(); as result) {
            <p role="status">{{ result }}</p>
          }
        </mat-card>
      }
    </main>
  `,
  styles: `
    .back {
      justify-self: start;
    }

    .what {
      display: flex;
      flex-direction: column;
    }

    .small {
      font-size: 0.8125rem;
    }

    .empty {
      padding: 0 1.25rem 1rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class Holdings {
  private readonly service = inject(PatrimonioService);
  protected readonly auth = inject(AuthService);
  protected readonly kinds = holdingKinds;

  protected readonly portfolios = signal<Portfolio[]>([]);
  private readonly holdings = signal<Holding[]>([]);
  protected readonly editing = signal<Holding | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly importResult = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    kind: ['Investment' as HoldingKind],
    portfolioId: [null as string | null],
    closed: [false],
  });

  /** Prima le aperte, poi le chiuse; in ordine di nome. */
  protected readonly sorted = computed(() =>
    [...this.holdings()].sort((a, b) => Number(a.closed) - Number(b.closed) || a.name.localeCompare(b.name, 'it')),
  );

  constructor() {
    void this.load();
  }

  protected describe(holding: Holding): string {
    const kind = holdingKinds.find((k) => k.kind === holding.kind)?.label;
    const portfolio = this.portfolios().find((p) => p.id === holding.portfolioId)?.name;
    return [kind, portfolio, holding.closed ? 'chiusa' : null].filter(Boolean).join(', ');
  }

  protected edit(holding: Holding): void {
    this.editing.set(holding);
    this.errors.set([]);
    this.form.setValue({ name: holding.name, kind: holding.kind, portfolioId: holding.portfolioId, closed: holding.closed });
  }

  protected cancel(): void {
    this.editing.set(null);
    this.form.reset();
  }

  protected saveHolding(): Promise<void> {
    return this.attempt(async () => {
      await this.service.saveHolding(this.form.getRawValue(), this.editing()?.id);
      this.cancel();
    });
  }

  protected removeHolding(holding: Holding): Promise<void> {
    if (!confirm(`Eliminare ${holding.name}? Se compare in una rilevazione, chiudila invece.`)) return Promise.resolve();
    return this.attempt(async () => {
      await this.service.removeHolding(holding.id);
      this.cancel();
    });
  }

  protected addPortfolio(): Promise<void> {
    const name = prompt('Nome del gestore (es. Intesa, Azimut, Gestito da me)')?.trim();
    return name ? this.attempt(() => this.service.savePortfolio(name)) : Promise.resolve();
  }

  protected renamePortfolio(portfolio: Portfolio): Promise<void> {
    const name = prompt('Nuovo nome del gestore', portfolio.name)?.trim();
    return name ? this.attempt(() => this.service.savePortfolio(name, portfolio.id)) : Promise.resolve();
  }

  protected removePortfolio(portfolio: Portfolio): Promise<void> {
    if (!confirm(`Eliminare il gestore ${portfolio.name}?`)) return Promise.resolve();
    return this.attempt(() => this.service.removePortfolio(portfolio.id));
  }

  protected async import(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.importResult.set(null);
    await this.attempt(async () => {
      let content: unknown;
      try {
        content = JSON.parse(await file.text());
      } catch {
        this.importResult.set('Il file non è un JSON valido.');
        return;
      }
      const { imported, skipped, createdAccounts } = await this.service.import(content);
      this.importResult.set(
        `Importate ${imported} rilevazioni, ${skipped} già presenti saltate; creati ${createdAccounts} conti in Conti.`,
      );
    });
  }

  /** Esegue l'azione e rilegge gestori e posizioni; se fallisce mostra l'errore. */
  private async attempt(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.errors.set([]);
    try {
      await action();
      await this.load();
    } catch (e) {
      this.errors.set(errorMessages(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const [portfolios, holdings] = await Promise.all([this.service.portfolios(), this.service.holdings()]);
    this.portfolios.set(portfolios);
    this.holdings.set(holdings);
  }
}
