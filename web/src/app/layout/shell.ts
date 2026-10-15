import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Icon, IconName } from './icon';

interface NavItem {
  path: string;
  icon: IconName;
  label: string;
}

// Sul telefono la barra in basso tiene cinque voci: categorie e ricorrenze si raggiungono dal Profilo.
const phoneItems: NavItem[] = [
  { path: '/', icon: 'list', label: 'Movimenti' },
  { path: '/statistiche', icon: 'pie', label: 'Statistiche' },
  { path: '/budget', icon: 'chart', label: 'Budget' },
  { path: '/conti', icon: 'wallet', label: 'Conti' },
  { path: '/profilo', icon: 'person', label: 'Profilo' },
];

// Sul desktop la colonna a sinistra ha posto per tutte le sezioni; il profilo sta in fondo, con il nome dell'utente.
const sections: NavItem[] = [
  ...phoneItems.filter((item) => item.path !== '/profilo'),
  { path: '/categorie', icon: 'label', label: 'Categorie' },
  { path: '/ricorrenze', icon: 'repeat', label: 'Ricorrenze' },
];

/**
 * Cornice delle pagine riservate. Su schermo largo: colonna di navigazione a sinistra, chiara, perché il rosso
 * resta alla fascia del mese. Sul telefono: barra fissa in basso, come nelle app; "Esci" si trova nel Profilo.
 */
@Component({
  selector: 'app-shell',
  imports: [Icon, MatButtonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <aside class="rail">
      <a class="brand" routerLink="/">
        <img src="icons/icon-192x192.png" alt="" width="40" height="40" />
        <span>OpenMoney</span>
      </a>
      <nav aria-label="Sezioni dell'app">
        @for (item of sections; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '/' }"
            ariaCurrentWhenActive="page"
          >
            <app-icon [name]="item.icon" />
            {{ item.label }}
          </a>
        }
      </nav>
      <span class="spacer"></span>
      <a class="me" routerLink="/profilo" routerLinkActive="active" ariaCurrentWhenActive="page">
        <span class="initial" aria-hidden="true">{{ initial() }}</span>
        <span class="name">{{ auth.user()?.displayName || auth.user()?.email }}</span>
      </a>
      <button matButton type="button" (click)="logout()">Esci</button>
    </aside>

    <div class="content">
      <router-outlet />
    </div>

    <nav class="bottom-nav" aria-label="Sezioni dell'app">
      @for (item of phoneItems; track item.path) {
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
    $rail: 15rem;

    .rail {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 5;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: $rail;
      padding: 1.25rem 0.875rem;
      background: var(--om-carta);
      border-right: 1px solid var(--om-filo);
    }

    .content {
      margin-left: $rail;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin: 0 0.375rem 1.5rem;
      color: var(--om-inchiostro);
      font: 650 1.25rem/1 var(--om-display);
      letter-spacing: -0.01em;
      text-decoration: none;
    }

    nav {
      display: grid;
      gap: 0.125rem;
    }

    .rail nav a,
    .me {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 2.75rem;
      padding: 0 0.75rem;
      color: var(--om-grafite);
      font-weight: 500;
      text-decoration: none;
      border-radius: 12px;
    }

    .rail nav a:hover,
    .me:hover {
      color: var(--om-inchiostro);
      background: color-mix(in srgb, var(--om-rosa) 55%, transparent);
    }

    .rail .active {
      color: var(--om-rosso);
      font-weight: 600;
      background: var(--om-rosa);
    }

    .me {
      margin-bottom: 0.25rem;
    }

    .name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    // L'iniziale dell'utente, la stessa che marca i suoi movimenti nel registro.
    .initial {
      display: grid;
      flex: none;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      color: var(--om-rosso);
      font: 600 0.875rem/1 var(--om-display);
      background: var(--om-rosa);
      border-radius: 50%;
    }

    .rail > button {
      align-self: flex-start;
    }

    // Barra in basso del telefono, sul modello della "navigation bar" di Material 3.
    .bottom-nav {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 5;
      display: none;
      grid-auto-columns: 1fr;
      grid-auto-flow: column;
      padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom));
      background: var(--om-carta);
      border-top: 1px solid var(--om-filo);
    }

    .bottom-nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: var(--om-grafite);
      font-size: 0.75rem;
      font-weight: 500;
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

    .bottom-nav .active {
      color: var(--om-rosso);
      font-weight: 600;
    }

    .bottom-nav .active .pill {
      background: var(--om-rosa);
    }

    @media (max-width: 599.98px) {
      .rail {
        display: none;
      }

      .content {
        margin-left: 0;
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
  protected readonly phoneItems = phoneItems;
  protected readonly sections = sections;

  protected initial(): string {
    const user = this.auth.user();
    return (user?.displayName || user?.email || '?').charAt(0).toUpperCase();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
