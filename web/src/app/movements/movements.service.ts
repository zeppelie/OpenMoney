import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type MovementKind = 'Income' | 'Expense' | 'Transfer';

export interface MovementInput {
  /** Formato ISO aaaa-mm-gg. */
  date: string;
  kind: MovementKind;
  /** Sempre positivo: il segno lo dà il tipo. */
  amount: number;
  accountId: string;
  /** Conto di destinazione, solo per i trasferimenti. */
  toAccountId: string | null;
  /** Solo per entrate e uscite. */
  categoryId: string | null;
  note: string | null;
}

export interface Movement extends MovementInput {
  id: string;
  /** Nome di chi l'ha inserito. */
  author: string | null;
}

export interface DayLedger {
  date: string;
  income: number;
  expense: number;
  movements: Movement[];
}

/** I movimenti di un mese raggruppati per giorno; i totali non contano i trasferimenti. */
export interface MonthLedger {
  income: number;
  expense: number;
  days: DayLedger[];
}

export interface MonthTotals {
  /** Da 1 a 12. */
  month: number;
  income: number;
  expense: number;
}

/** Come si intitola un movimento in un elenco: la categoria, o i due conti di un trasferimento. */
export function movementTitle(
  movement: MovementInput,
  accountNames: Map<string, string>,
  categoryNames: Map<string, string>,
): string {
  return movement.kind === 'Transfer'
    ? `${accountNames.get(movement.accountId)} → ${accountNames.get(movement.toAccountId!)}`
    : (categoryNames.get(movement.categoryId!) ?? '');
}

@Injectable({ providedIn: 'root' })
export class MovementsService {
  private readonly http = inject(HttpClient);

  month(year: number, month: number): Promise<MonthLedger> {
    return firstValueFrom(this.http.get<MonthLedger>('/api/movements', { params: { year, month } }));
  }

  year(year: number): Promise<MonthTotals[]> {
    return firstValueFrom(this.http.get<MonthTotals[]>(`/api/movements/years/${year}`));
  }

  /** Con `id` modifica il movimento, senza ne crea uno. */
  save(input: MovementInput, id?: string): Promise<unknown> {
    return firstValueFrom(id ? this.http.put(`/api/movements/${id}`, input) : this.http.post('/api/movements', input));
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/movements/${id}`));
  }
}
