import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Account } from '../accounts/accounts.service';
import { Category, categoryTree } from '../categories/categories.service';
import { Frequency, Recurrence, RecurrencesService, frequencies } from '../recurrences/recurrences.service';
import { Icon } from '../layout/icon';
import { submitDialog } from '../shared/dialogs';
import { errorMessages } from '../shared/errors';
import { AttachmentInfo, Movement, MovementInput, MovementKind, MovementsService } from './movements.service';
import { MovementTemplate, TemplatesService } from './templates.service';

export interface MovementDialogData {
  /** Il movimento da modificare; null per crearne uno o per lavorare su una ricorrenza. */
  movement: Movement | null;
  /** La ricorrenza da modificare; null negli altri casi. */
  recurrence: Recurrence | null;
  /** Data proposta per un movimento nuovo (ISO aaaa-mm-gg). */
  date: string;
  accounts: Account[];
  categories: Category[];
}

/**
 * Inserisce un'entrata, un'uscita o un trasferimento. Scegliendo "Ripeti" il movimento diventa una ricorrenza
 * (con un numero di volte, un piano di rate). Se riceve un movimento o una ricorrenza li modifica o li elimina.
 */
@Component({
  selector: 'app-movement-dialog',
  imports: [
    Icon,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        @if (templates().length) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Da un modello</mat-label>
            <mat-select (selectionChange)="applyTemplate($event.value)">
              @for (template of templates(); track template.id) {
                <mat-option [value]="template">{{ template.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-button-toggle-group formControlName="kind" aria-label="Tipo di movimento" hideSingleSelectionIndicator>
          <mat-button-toggle value="Expense">Uscita</mat-button-toggle>
          <mat-button-toggle value="Income">Entrata</mat-button-toggle>
          <mat-button-toggle value="Transfer">Trasferimento</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ repeats() ? 'Prima data' : 'Data' }}</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Importo (€)</mat-label>
          <input matInput type="number" step="0.01" min="0.01" inputmode="decimal" formControlName="amount" />
          @if (repeats()) {
            <mat-hint>L'importo di ogni volta (di ogni rata), non il totale.</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ kind() === 'Transfer' ? 'Dal conto' : 'Conto' }}</mat-label>
          <mat-select formControlName="accountId">
            @for (account of data.accounts; track account.id) {
              <mat-option [value]="account.id">{{ account.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (kind() === 'Transfer') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Al conto</mat-label>
            <mat-select formControlName="toAccountId">
              @for (account of data.accounts; track account.id) {
                <mat-option [value]="account.id">{{ account.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Categoria</mat-label>
            <mat-select formControlName="categoryId">
              @for (node of categories(); track node.category.id) {
                <mat-option [value]="node.category.id">{{ node.category.name }}</mat-option>
                @for (child of node.children; track child.id) {
                  <mat-option [value]="child.id">{{ node.category.name }} › {{ child.name }}</mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nota</mat-label>
          <input matInput formControlName="note" maxlength="200" />
        </mat-form-field>

        @if (!data.recurrence && !repeats()) {
          <div class="attachments">
            @for (attachment of attachments(); track attachment.id) {
              <span class="file">
                <a [href]="'/api/attachments/' + attachment.id" target="_blank" rel="noopener">{{ attachment.fileName }}</a>
                <button matIconButton type="button" (click)="removeAttachment(attachment)" [attr.aria-label]="'Togli ' + attachment.fileName">
                  <app-icon name="close" />
                </button>
              </span>
            }
            @for (file of pending(); track file) {
              <span class="file">
                <span>{{ file.name }} <span class="muted">(da caricare)</span></span>
                <button matIconButton type="button" (click)="unqueue(file)" [attr.aria-label]="'Togli ' + file.name">
                  <app-icon name="close" />
                </button>
              </span>
            }
            <!-- Sul telefono "image/*" propone anche la fotocamera: si fotografa lo scontrino al momento. -->
            <input #picker type="file" accept="image/*,application/pdf" multiple hidden (change)="queue($event)" />
            <button matButton type="button" (click)="picker.click()">
              <app-icon name="camera" />
              Allega scontrino
            </button>
          </div>
        }

        @if (!data.movement) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Ripeti</mat-label>
            <mat-select formControlName="frequency">
              @if (!data.recurrence) {
                <mat-option value="None">Mai</mat-option>
              }
              @for (item of frequencies; track item.frequency) {
                <mat-option [value]="item.frequency">{{ item.label }}</mat-option>
              }
            </mat-select>
            @if (data.recurrence) {
              <mat-hint>Prima data e frequenza non si cambiano: per farlo elimina la ricorrenza e creane una nuova.</mat-hint>
            }
          </mat-form-field>
        }

        @if (repeats()) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Numero di volte (rate)</mat-label>
            <input matInput type="number" step="1" min="1" inputmode="numeric" formControlName="occurrences" />
            <mat-hint>Vuoto: senza limite.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Fino al</mat-label>
            <input matInput type="date" formControlName="endDate" />
          </mat-form-field>
        }

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.movement || data.recurrence) {
          <button matButton type="button" (click)="remove()">Elimina</button>
        }
        @if (!data.recurrence) {
          <button matButton type="button" (click)="saveTemplate()">Salva come modello</button>
        }
        <span class="spacer"></span>
        <!-- Anche annullando, se nel frattempo è stato tolto un allegato la pagina deve aggiornarsi. -->
        <button matButton type="button" (click)="ref.close(touched)">Annulla</button>
        <button matButton="filled" type="submit" [disabled]="form.invalid">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.attachments {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.5rem;
    }

    .file {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
  `,
})
export class MovementDialog {
  protected readonly data = inject<MovementDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<MovementDialog, boolean>>(MatDialogRef);
  private readonly movements = inject(MovementsService);
  private readonly recurrences = inject(RecurrencesService);
  private readonly templatesService = inject(TemplatesService);
  protected readonly frequencies = frequencies;

  protected readonly title = this.data.recurrence
    ? 'Modifica ricorrenza'
    : this.data.movement
      ? 'Modifica movimento'
      : 'Nuovo movimento';

  // Di una ricorrenza si modifica il modello: i suoi campi sono quelli di un movimento.
  private readonly source = this.data.recurrence?.movement ?? this.data.movement;
  // Il calendario di una ricorrenza esistente è fisso (vedi il suggerimento sotto "Ripeti").
  private readonly scheduleLocked = !!this.data.recurrence;

  protected readonly form = inject(FormBuilder).group({
    kind: [this.source?.kind ?? ('Expense' as MovementKind), Validators.required],
    date: [{ value: this.source?.date ?? this.data.date, disabled: this.scheduleLocked }, Validators.required],
    amount: [this.source?.amount ?? null, [Validators.required, Validators.min(0.01)]],
    accountId: [this.source?.accountId ?? this.data.accounts[0]?.id ?? null, Validators.required],
    toAccountId: [this.source?.toAccountId ?? null],
    categoryId: [this.source?.categoryId ?? null],
    note: [this.source?.note ?? null],
    frequency: [
      { value: this.data.recurrence?.frequency ?? ('None' as Frequency | 'None'), disabled: this.scheduleLocked },
    ],
    occurrences: [this.data.recurrence?.occurrences ?? null, Validators.min(1)],
    endDate: [this.data.recurrence?.endDate ?? null],
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, { initialValue: this.form.controls.kind.value });
  private readonly frequency = toSignal(this.form.controls.frequency.valueChanges, {
    initialValue: this.form.controls.frequency.value,
  });
  protected readonly repeats = computed(() => this.frequency() !== 'None');

  /** Le categorie del tipo scelto; vuote per i trasferimenti, che non ne hanno. */
  protected readonly categories = computed(() => {
    const kind = this.kind();
    return kind === 'Income' || kind === 'Expense' ? categoryTree(this.data.categories, kind) : [];
  });

  /** I modelli tra cui scegliere: solo inserendo un movimento nuovo. */
  protected readonly templates = signal<MovementTemplate[]>([]);
  protected readonly attachments = signal<AttachmentInfo[]>(this.data.movement?.attachments ?? []);
  /** File scelti ma non ancora caricati: si caricano salvando, quando il movimento esiste. */
  protected readonly pending = signal<File[]>([]);
  protected readonly errors = signal<string[]>([]);

  /** Vero se qualcosa è già cambiato sul server, anche senza premere Salva (un allegato tolto). */
  protected touched = false;
  // Se il caricamento di un allegato fallisce dopo aver creato il movimento, riprovando lo si modifica invece di duplicarlo.
  private savedId = this.data.movement?.id;

  constructor() {
    // Una categoria di uscita non vale per un'entrata: cambiando tipo si riparte da capo.
    this.form.controls.kind.valueChanges.subscribe(() => this.form.controls.categoryId.setValue(null));
    if (!this.data.movement && !this.data.recurrence) void this.loadTemplates();
  }

  /** Riempie il modulo con un modello; data e, se il modello non ce l'ha, importo restano quelli scritti. */
  protected applyTemplate(template: MovementTemplate): void {
    // Il tipo per primo: cambiandolo si azzera la categoria, che va impostata dopo.
    this.form.patchValue({ kind: template.kind });
    this.form.patchValue({
      accountId: template.accountId,
      toAccountId: template.toAccountId,
      categoryId: template.categoryId,
      note: template.note,
      ...(template.amount !== null && { amount: template.amount }),
    });
  }

  protected async saveTemplate(): Promise<void> {
    const name = prompt('Nome del modello (es. "Spesa Esselunga")')?.trim();
    if (!name) return;

    const { kind, amount, accountId, toAccountId, categoryId, note } = this.form.getRawValue();
    this.errors.set([]);
    try {
      await this.templatesService.create({
        name,
        kind: kind!,
        amount,
        accountId: accountId!,
        toAccountId,
        categoryId,
        note,
      });
      await this.loadTemplates();
    } catch (e) {
      this.errors.set(errorMessages(e));
    }
  }

  protected queue(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pending.update((files) => [...files, ...Array.from(input.files ?? [])]);
    // Così si può scegliere di nuovo lo stesso file dopo averlo tolto.
    input.value = '';
  }

  protected unqueue(file: File): void {
    this.pending.update((files) => files.filter((pending) => pending !== file));
  }

  protected async removeAttachment(attachment: AttachmentInfo): Promise<void> {
    if (!confirm(`Togliere ${attachment.fileName}?`)) return;
    this.errors.set([]);
    try {
      await this.movements.removeAttachment(attachment.id);
      this.attachments.update((attachments) => attachments.filter((a) => a.id !== attachment.id));
      this.touched = true;
    } catch (e) {
      this.errors.set(errorMessages(e));
    }
  }

  protected save(): Promise<void> {
    const { kind, date, amount, accountId, frequency, occurrences, endDate, ...rest } = this.form.getRawValue();
    // Il pulsante Salva è spento finché questi campi obbligatori mancano.
    const movement = { kind: kind!, date: date!, amount: amount!, accountId: accountId!, ...rest };

    return submitDialog(this.ref, this.errors, () =>
      frequency && frequency !== 'None'
        ? // Un campo data svuotato vale "", che per il server non è una data.
          this.recurrences.save({ movement, frequency, occurrences, endDate: endDate || null }, this.data.recurrence?.id)
        : this.saveMovement(movement),
    );
  }

  protected remove(): Promise<void> {
    return submitDialog(this.ref, this.errors, () =>
      this.data.recurrence
        ? this.recurrences.remove(this.data.recurrence.id)
        : this.movements.remove(this.data.movement!.id),
    );
  }

  private async saveMovement(movement: MovementInput): Promise<void> {
    this.savedId = await this.movements.save(movement, this.savedId);
    this.touched = true;
    for (const file of this.pending()) {
      await this.movements.attach(this.savedId, file);
      this.unqueue(file);
    }
  }

  private async loadTemplates(): Promise<void> {
    this.templates.set(await this.templatesService.list());
  }
}
