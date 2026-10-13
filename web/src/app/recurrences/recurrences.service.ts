import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MovementInput } from '../movements/movements.service';

export type Frequency = 'Weekly' | 'Monthly' | 'Yearly';

export const frequencies: { frequency: Frequency; label: string }[] = [
  { frequency: 'Weekly', label: 'Ogni settimana' },
  { frequency: 'Monthly', label: 'Ogni mese' },
  { frequency: 'Yearly', label: 'Ogni anno' },
];

export interface RecurrenceInput {
  /** Il modello dei movimenti generati; la sua data è quella della prima volta. */
  movement: MovementInput;
  frequency: Frequency;
  /** Numero fisso di volte (le rate); null se non c'è limite. */
  occurrences: number | null;
  /** Ultimo giorno utile (ISO aaaa-mm-gg), compreso; null se non c'è. */
  endDate: string | null;
}

export interface Recurrence extends RecurrenceInput {
  id: string;
  /** Quanti movimenti ha già generato. */
  generatedCount: number;
  /** Data del prossimo movimento; null se è finita. */
  nextDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecurrencesService {
  private readonly http = inject(HttpClient);

  list(): Promise<Recurrence[]> {
    return firstValueFrom(this.http.get<Recurrence[]>('/api/recurrences'));
  }

  /** Con `id` modifica la ricorrenza, senza ne crea una (e genera subito i movimenti già maturati). */
  save(input: RecurrenceInput, id?: string): Promise<unknown> {
    return firstValueFrom(
      id ? this.http.put(`/api/recurrences/${id}`, input) : this.http.post('/api/recurrences', input),
    );
  }

  /** I movimenti già generati restano. */
  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/recurrences/${id}`));
  }
}
