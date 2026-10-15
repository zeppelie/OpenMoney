import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MovementKind } from './movements.service';

/** Un movimento che si inserisce spesso: tutto tranne la data; l'importo è facoltativo. */
export interface TemplateInput {
  name: string;
  kind: MovementKind;
  amount: number | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string | null;
}

export interface MovementTemplate extends TemplateInput {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly http = inject(HttpClient);

  list(): Promise<MovementTemplate[]> {
    return firstValueFrom(this.http.get<MovementTemplate[]>('/api/templates'));
  }

  create(input: TemplateInput): Promise<unknown> {
    return firstValueFrom(this.http.post('/api/templates', input));
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/templates/${id}`));
  }
}
