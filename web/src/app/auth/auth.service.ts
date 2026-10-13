import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface User {
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}

/** Sessione basata su cookie HttpOnly: il browser lo invia da solo, il frontend non gestisce token. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private loaded = false;

  readonly user = signal<User | null>(null);

  /** Chiede al server chi è l'utente corrente (una sola volta finché la sessione non cambia). */
  async load(): Promise<User | null> {
    if (!this.loaded) {
      try {
        this.user.set(await firstValueFrom(this.http.get<User>('/api/profile')));
      } catch {
        this.user.set(null);
      }
      this.loaded = true;
    }
    return this.user();
  }

  /** Vero finché non esiste nessun utente: chi apre l'app crea l'amministratore. */
  async setupRequired(): Promise<boolean> {
    const status = await firstValueFrom(this.http.get<{ setupRequired: boolean }>('/api/auth/status'));
    return status.setupRequired;
  }

  /** Con `remember` il cookie resta anche dopo la chiusura del browser; senza, la sessione finisce lì. */
  async login(email: string, password: string, remember = true): Promise<void> {
    const cookie = remember ? 'useCookies' : 'useSessionCookies';
    await firstValueFrom(this.http.post(`/api/auth/login?${cookie}=true`, { email, password }));
    this.loaded = false;
    await this.load();
  }

  async setup(email: string, password: string, displayName: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/setup', { email, password, displayName }));
    await this.login(email, password);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.user.set(null);
    this.loaded = true;
  }

  async updateProfile(displayName: string): Promise<void> {
    this.user.set(await firstValueFrom(this.http.put<User>('/api/profile', { displayName })));
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/manage/info', { oldPassword, newPassword }));
  }
}
