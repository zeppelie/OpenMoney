import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Una categoria di uscita nel mese: il budget, se ne ha uno, e quanto si è speso. */
export interface BudgetLine {
  categoryId: string;
  name: string;
  budget: number | null;
  spent: number;
  /** Negativo se si è sforato; null senza budget. */
  remaining: number | null;
}

/** I totali riguardano solo le categorie che hanno un budget. */
export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  lines: BudgetLine[];
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);

  status(year: number, month: number): Promise<BudgetStatus> {
    return firstValueFrom(this.http.get<BudgetStatus>('/api/budgets', { params: { year, month } }));
  }

  /** Imposta il budget mensile della categoria. */
  set(categoryId: string, amount: number): Promise<unknown> {
    return firstValueFrom(this.http.put(`/api/budgets/${categoryId}`, { amount }));
  }

  remove(categoryId: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/budgets/${categoryId}`));
  }
}
