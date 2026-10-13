import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { errorMessages } from '../shared/errors';
import { Users } from './users';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, Users],
  template: `
    <main class="page">
      <h1>Profilo</h1>

      <mat-card appearance="outlined">
        <form class="stack" [formGroup]="nameForm" (ngSubmit)="saveName()">
          <h2>{{ auth.user()?.email }}</h2>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nome</mat-label>
            <input matInput formControlName="displayName" autocomplete="name" />
          </mat-form-field>
          @for (error of nameErrors(); track error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <div class="actions">
            <button matButton="filled" type="submit">Salva</button>
            <button matButton type="button" (click)="logout()">Esci</button>
          </div>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <form class="stack" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
          <h2>Cambia password</h2>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Password attuale</mat-label>
            <input matInput type="password" formControlName="oldPassword" autocomplete="current-password" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nuova password</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          </mat-form-field>
          @for (error of passwordErrors(); track error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <div class="actions">
            <button matButton="filled" type="submit" [disabled]="passwordForm.invalid">Cambia password</button>
          </div>
        </form>
      </mat-card>

      @if (auth.user()?.isAdmin) {
        <app-users />
      }
    </main>
  `,
  styles: `
    .actions {
      display: flex;
      gap: 0.5rem;
    }
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly forms = inject(FormBuilder).nonNullable;

  protected readonly nameForm = this.forms.group({ displayName: [this.auth.user()?.displayName ?? ''] });
  protected readonly passwordForm = this.forms.group({
    oldPassword: ['', Validators.required],
    newPassword: ['', Validators.required],
  });

  protected readonly nameErrors = signal<string[]>([]);
  protected readonly passwordErrors = signal<string[]>([]);

  protected async saveName(): Promise<void> {
    this.nameErrors.set([]);
    try {
      await this.auth.updateProfile(this.nameForm.getRawValue().displayName);
      this.snackBar.open('Nome salvato', undefined, { duration: 3000 });
    } catch (e) {
      this.nameErrors.set(errorMessages(e));
    }
  }

  protected async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    const { oldPassword, newPassword } = this.passwordForm.getRawValue();
    this.passwordErrors.set([]);
    try {
      await this.auth.changePassword(oldPassword, newPassword);
      this.passwordForm.reset();
      this.snackBar.open('Password cambiata', undefined, { duration: 3000 });
    } catch (e) {
      this.passwordErrors.set(errorMessages(e));
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
