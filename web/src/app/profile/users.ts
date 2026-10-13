import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { Icon } from '../layout/icon';
import { errorMessages } from '../shared/errors';

interface FamilyUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}

/** Utenti della famiglia: li crea, li elimina e ne reimposta la password solo l'amministratore. */
@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, Icon, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-card appearance="outlined">
      <div class="stack">
        <h2>Utenti</h2>

        <ul>
          @for (user of users(); track user.id) {
            <li>
              <span class="who">
                {{ user.displayName || user.email }}
                <span class="muted">{{ user.displayName ? user.email : '' }} {{ user.isAdmin ? '· amministratore' : '' }}</span>
              </span>
              <button matButton type="button" (click)="resetPassword(user)">Nuova password</button>
              @if (!user.isAdmin) {
                <button matIconButton type="button" (click)="remove(user)" [attr.aria-label]="'Elimina ' + user.email">
                  <app-icon name="delete" />
                </button>
              }
            </li>
          }
        </ul>

        <form class="new" [formGroup]="form" (ngSubmit)="create()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome</mat-label>
            <input matInput formControlName="displayName" autocomplete="off" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="off" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>
          <button matButton="filled" type="submit" [disabled]="form.invalid">Aggiungi utente</button>
        </form>

        @for (error of errors(); track error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </div>
    </mat-card>
  `,
  styles: `
    ul {
      display: grid;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 3rem;
    }

    .who {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .who .muted {
      display: block;
      font: var(--mat-sys-body-small);
    }

    .new {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      align-items: center;
    }
  `,
})
export class Users {
  private readonly http = inject(HttpClient);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: [''],
    email: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly users = signal<FamilyUser[]>([]);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    void this.attempt(async () => {});
  }

  protected create(): Promise<void> {
    return this.attempt(async () => {
      await firstValueFrom(this.http.post('/api/users', this.form.getRawValue()));
      this.form.reset();
    });
  }

  protected async resetPassword(user: FamilyUser): Promise<void> {
    const password = prompt(`Nuova password per ${user.email}`);
    if (password) await this.attempt(() => firstValueFrom(this.http.post(`/api/users/${user.id}/password`, { password })));
  }

  protected async remove(user: FamilyUser): Promise<void> {
    if (confirm(`Eliminare ${user.email}?`)) await this.attempt(() => firstValueFrom(this.http.delete(`/api/users/${user.id}`)));
  }

  /** Esegue l'azione e rilegge l'elenco; se fallisce mostra l'errore. */
  private async attempt(action: () => Promise<unknown>): Promise<void> {
    this.errors.set([]);
    try {
      await action();
      this.users.set(await firstValueFrom(this.http.get<FamilyUser[]>('/api/users')));
    } catch (e) {
      this.errors.set(errorMessages(e));
    }
  }
}
