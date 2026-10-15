import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type HoldingKind = 'Investment' | 'Pension' | 'Debt';

export const holdingKinds: { kind: HoldingKind; label: string }[] = [
  { kind: 'Investment', label: 'Investimento' },
  { kind: 'Pension', label: 'Previdenza' },
  { kind: 'Debt', label: 'Debito (mutuo)' },
];

/** Un gestore o macrosettore: Intesa, Azimut, Gestito da me… */
export interface Portfolio {
  id: string;
  name: string;
}

export interface HoldingInput {
  name: string;
  kind: HoldingKind;
  /** Solo per gli investimenti. */
  portfolioId: string | null;
  /** Una posizione chiusa resta nello storico ma non viene più proposta. */
  closed: boolean;
}

export interface Holding extends HoldingInput {
  id: string;
}

export interface SnapshotHolding {
  holdingId: string;
  /** Quanto vi si è messo finora; null se non è noto. */
  invested: number | null;
  value: number;
}

/** Con `accountId` è un conto di OpenMoney; senza, un conto tenuto solo nelle rilevazioni. */
export interface SnapshotAccount {
  accountId: string | null;
  name: string;
  balance: number;
}

export interface SnapshotValues {
  /** ISO aaaa-mm-gg. */
  date: string;
  holdings: SnapshotHolding[];
  accounts: SnapshotAccount[];
  note: string | null;
}

export interface HoldingSummary {
  holdingId: string;
  name: string;
  invested: number | null;
  value: number;
  gain: number | null;
  gainPercent: number | null;
}

export interface PortfolioSummary {
  portfolioId: string;
  name: string;
  holdings: HoldingSummary[];
  value: number;
  invested: number | null;
  gain: number | null;
  gainPercent: number | null;
}

/** Una rilevazione letta come nel foglio "Generale". */
export interface SnapshotSummary {
  id: string;
  date: string;
  note: string | null;
  portfolios: PortfolioSummary[];
  accounts: SnapshotAccount[];
  pension: HoldingSummary[];
  debts: HoldingSummary[];
  /** Somma degli investimenti. */
  managed: number;
  /** Somma dei conti. */
  liquidity: number;
  /** Gestito più conti. */
  total: number;
  pensionTotal: number;
  debtTotal: number;
  /** Totale più previdenza, meno i debiti. */
  netWorth: number;
}

export type SnapshotTotals = Pick<
  SnapshotSummary,
  'id' | 'date' | 'managed' | 'liquidity' | 'total' | 'pensionTotal' | 'debtTotal' | 'netWorth'
>;

@Injectable({ providedIn: 'root' })
export class PatrimonioService {
  private readonly http = inject(HttpClient);

  portfolios(): Promise<Portfolio[]> {
    return firstValueFrom(this.http.get<Portfolio[]>('/api/portfolios'));
  }

  savePortfolio(name: string, id?: string): Promise<unknown> {
    return firstValueFrom(
      id ? this.http.put(`/api/portfolios/${id}`, { name }) : this.http.post('/api/portfolios', { name }),
    );
  }

  removePortfolio(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/portfolios/${id}`));
  }

  holdings(): Promise<Holding[]> {
    return firstValueFrom(this.http.get<Holding[]>('/api/holdings'));
  }

  saveHolding(input: HoldingInput, id?: string): Promise<unknown> {
    return firstValueFrom(id ? this.http.put(`/api/holdings/${id}`, input) : this.http.post('/api/holdings', input));
  }

  removeHolding(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/holdings/${id}`));
  }

  /** Le rilevazioni in ordine di data, con i soli totali. */
  snapshots(): Promise<SnapshotTotals[]> {
    return firstValueFrom(this.http.get<SnapshotTotals[]>('/api/snapshots'));
  }

  snapshot(id: string): Promise<SnapshotSummary> {
    return firstValueFrom(this.http.get<SnapshotSummary>(`/api/snapshots/${id}`));
  }

  values(id: string): Promise<SnapshotValues> {
    return firstValueFrom(this.http.get<SnapshotValues>(`/api/snapshots/${id}/values`));
  }

  /** La rilevazione proposta per una data: valori della volta prima e saldi dei conti calcolati. */
  draft(date: string): Promise<SnapshotValues> {
    return firstValueFrom(this.http.get<SnapshotValues>('/api/snapshots/draft', { params: { date } }));
  }

  /** Restituisce l'identificativo della rilevazione. */
  async save(values: SnapshotValues, id?: string): Promise<string> {
    if (id) {
      await firstValueFrom(this.http.put(`/api/snapshots/${id}`, values));
      return id;
    }
    return (await firstValueFrom(this.http.post<{ id: string }>('/api/snapshots', values))).id;
  }

  remove(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/snapshots/${id}`));
  }

  /** Importa uno storico in JSON (vedi README); restituisce quante rilevazioni ha aggiunto e quante ha saltato. */
  import(content: unknown): Promise<{ imported: number; skipped: number }> {
    return firstValueFrom(this.http.post<{ imported: number; skipped: number }>('/api/snapshots/import', content));
  }
}
