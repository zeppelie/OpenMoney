import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Icon, IconName } from './icon';

interface NavItem {
  path: string;
  icon: IconName;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: 'list', label: 'Movimenti' },
  { path: '/conti', icon: 'wallet', label: 'Conti' },
  { path: '/categorie', icon: 'label', label: 'Categorie' },
  { path: '/profilo', icon: 'person', label: 'Profilo' },
];

// Sul desktop il profilo sta a destra, con il nome dell'utente.
const sections = navItems.filter((item) => item.path !== '/profilo');

/**
 * Cornice delle pagine riservate. Su schermo largo: barra in alto con tutte le voci.
 * Sul telefono: barra sottile in alto e voci con icona in una barra fissa in basso, come nelle app;
 * "Esci" si trova nel Profilo.
 */
@Component({
  selector: 'app-shell',
  imports: [Icon, MatButtonModule, MatToolbarModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <mat-toolbar class="bar">
      <a class="brand" routerLink="/">
        <img src="icons/icon-192x192.png" alt="" width="32" height="32" />
        OpenMoney
      </a>
      <span class="desktop-only links">
        @for (item of sections; track item.path) {
          <a matButton [routerLink]="item.path">{{ item.label }}</a>
        }
      </span>
      <span class="spacer"></span>
      <span class="desktop-only links">
        <a matButton routerLink="/profilo">
          <app-icon name="person" />
          {{ auth.user()?.displayName || auth.user()?.email }}
        </a>
        <button matButton type="button" (click)="logout()">Esci</button>
      </span>
    </mat-toolbar>

    <router-outlet />

    <nav class="bottom-nav" aria-label="Sezioni dell'app">
      @for (item of navItems; track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.path === '/' }"
          ariaCurrentWhenActive="page"
        >
          <span class="pill"><app-icon [name]="item.icon" /></span>
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .bar {
      gap: 0.5rem;
    }

    .links,
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .brand {
      color: inherit;
      text-decoration: none;
    }

    // Barra in basso del telefono, sul modello della "navigation bar" di Material 3.
    .bottom-nav {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 5;
      display: none;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom));
      background: var(--mat-sys-surface-container);
      box-shadow: 0 -1px 0 var(--mat-sys-outline-variant);
    }

    .bottom-nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }

    .pill {
      display: flex;
      justify-content: center;
      width: 3.5rem;
      padding: 0.25rem 0;
      border-radius: 1rem;
    }

    .active {
      color: var(--mat-sys-on-surface);
      font-weight: 600;
    }

    .active .pill {
      color: var(--mat-sys-on-secondary-container);
      background: var(--mat-sys-secondary-container);
    }

    @media (max-width: 599.98px) {
      .bar {
        min-height: 3.5rem;
      }

      .bottom-nav {
        display: grid;
      }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly navItems = navItems;
  protected readonly sections = sections;

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
