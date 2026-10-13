import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { errorMessages } from '../shared/errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <main class="center">
      <mat-card class="card" appearance="raised">
        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          <img src="icons/icon-192x192.png" alt="" width="72" height="72" />
          <h1>OpenMoney</h1>
          <p class="muted">
            {{ settingUp() ? "Primo avvio: crea l'account dell'amministratore." : 'Accedi per continuare.' }}
          </p>

          @if (settingUp()) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Nome</mat-label>
              <input matInput formControlName="displayName" autocomplete="name" />
            </mat-form-field>
          }

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              [autocomplete]="settingUp() ? 'new-password' : 'current-password'"
            />
            @if (settingUp()) {
              <mat-hint>Almeno 6 caratteri con maiuscola, minuscola, cifra e simbolo.</mat-hint>
            }
          </mat-form-field>

          @if (!settingUp()) {
            <label class="remember">
              <input type="checkbox" formControlName="remember" />
              Resta collegato
            </label>
          }

          @for (error of errors(); track error) {
            <p class="error" role="alert">{{ error }}</p>
          }

          <button matButton="filled" type="submit" [disabled]="form.invalid || busy()">
            {{ settingUp() ? 'Crea account' : 'Accedi' }}
          </button>
        </form>
      </mat-card>
    </main>
  `,
  styles: `
    .card {
      width: 100%;
      max-width: 24rem;
    }

    img {
      align-self: center;
    }

    .remember {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font: var(--mat-sys-body-medium);
    }

    .remember input {
      width: 1.15rem;
      height: 1.15rem;
      accent-color: var(--mat-sys-primary);
    }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: [''],
    email: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true],
  });

  protected readonly settingUp = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);

  constructor() {
    this.auth
      .setupRequired()
      .then((required) => this.settingUp.set(required))
      .catch(() => {});
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return;

    const { displayName, email, password, remember } = this.form.getRawValue();
    this.busy.set(true);
    this.errors.set([]);
    try {
      await (this.settingUp()
        ? this.auth.setup(email, password, displayName)
        : this.auth.login(email, password, remember));
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.errors.set(errorMessages(e, { 401: 'invalidCredentials', 403: 'setupClosed' }));
    } finally {
      this.busy.set(false);
    }
  }
}
