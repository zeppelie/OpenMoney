import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Icon } from '../layout/icon';
import { MovementTemplate, TemplatesService } from '../movements/templates.service';
import { errorMessages } from '../shared/errors';

/** I modelli di movimento: si creano dal modulo del movimento ("Salva come modello"), qui si eliminano. */
@Component({
  selector: 'app-templates',
  imports: [Icon, MatButtonModule, MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <div class="stack">
        <h2>Modelli di movimento</h2>
        @for (template of templates(); track template.id) {
          <div class="item">
            <span>{{ template.name }}</span>
            <button matIconButton type="button" (click)="remove(template)" [attr.aria-label]="'Elimina ' + template.name">
              <app-icon name="delete" />
            </button>
          </div>
        } @empty {
          <p class="muted">Nessun modello: nel modulo di un movimento usa "Salva come modello".</p>
        }
        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </div>
    </mat-card>
  `,
  styles: `
    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `,
})
export class Templates {
  private readonly service = inject(TemplatesService);

  protected readonly templates = signal<MovementTemplate[]>([]);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    void this.load();
  }

  protected async remove(template: MovementTemplate): Promise<void> {
    if (!confirm(`Eliminare il modello "${template.name}"?`)) return;
    this.errors.set([]);
    try {
      await this.service.remove(template.id);
      await this.load();
    } catch (e) {
      this.errors.set(errorMessages(e));
    }
  }

  private async load(): Promise<void> {
    this.templates.set(await this.service.list());
  }
}
