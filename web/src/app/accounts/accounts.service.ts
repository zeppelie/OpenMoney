import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AccountGroup = 'Cash' | 'Bank' | 'Card' | 'Savings' | 'Investments' | 'Loan';

/** I gruppi nell'ordine in cui si mostrano. */
export const accountGroups: { group: AccountGroup; label: string }[] = [
  { group: 'Cash', label: 'Contanti' },
  { group: 'Bank', label: 'Conti bancari' },
  { group: 'Card', label: 'Carte' },
  { group: 'Savings', label: 'Risparmi' },
  { group: 'Investments', label: 'Investimenti' },
  { group: 'Loan', label: 'Prestiti' },
];

export interface AccountInput {
  name: string;
  group: AccountGroup;
  initialBalance: number;
  /** Solo per le carte: il conto su cui ogni mese si addebitano le spese del mese prima; null senza addebito automatico. */
  settlementAccountId: string | null;
  /** Giorno del mese (1-28) in cui avviene l'addebito; va insieme al conto. */
  settlementDay: number | null;
}

export interface Account extends AccountInput {
  id: string;
  /** Saldo attuale, calcolato dal server da saldo iniziale e movimenti. */
  balance: number;
}

export interface AccountsOverview {
  netWorth: { assets: number; liabilities: number; total: number };
  accounts: Account[];
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Promise<AccountsOverview> {
    return firstValueFrom(this.http.get<AccountsOverview>('/api/accounts'));
  }

  /** Con `id` modifica il conto, senza ne crea uno. */
  save(input: AccountInput, id?: string): Promise<unknown> {
    return firstValueFrom(id ? this.http.put(`/api/accounts/${id}`, input) : this.http.post('/api/accounts', input));
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/accounts/${id}`));
  }
}
