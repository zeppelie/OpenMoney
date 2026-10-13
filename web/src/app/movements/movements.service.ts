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

/** Filtri della ricerca: valgono tutti insieme, quelli nulli o vuoti non filtrano. */
export interface SearchCriteria {
  /** Testo cercato nella nota. */
  text: string | null;
  /** Estremi dell'intervallo di date (ISO aaaa-mm-gg), compresi. */
  from: string | null;
  to: string | null;
  accountId: string | null;
  /** Una categoria di primo livello comprende le sue sottocategorie. */
  categoryId: string | null;
  kind: MovementKind | null;
}

export interface SearchResult {
  ledger: MonthLedger;
  /** Vero se i movimenti trovati sono più di quelli mostrati. */
  truncated: boolean;
}

function searchParams(criteria: SearchCriteria): Record<string, string> {
  return Object.fromEntries(Object.entries(criteria).filter((entry): entry is [string, string] => !!entry[1]));
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

  search(criteria: SearchCriteria): Promise<SearchResult> {
    return firstValueFrom(this.http.get<SearchResult>('/api/movements/search', { params: searchParams(criteria) }));
  }

  /** Indirizzo da cui scaricare in CSV tutti i movimenti che rispettano i filtri. */
  exportUrl(criteria: SearchCriteria): string {
    return `/api/movements/export?${new URLSearchParams(searchParams(criteria))}`;
  }

  /** Con `id` modifica il movimento, senza ne crea uno. */
  save(input: MovementInput, id?: string): Promise<unknown> {
    return firstValueFrom(id ? this.http.put(`/api/movements/${id}`, input) : this.http.post('/api/movements', input));
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/movements/${id}`));
  }
}
