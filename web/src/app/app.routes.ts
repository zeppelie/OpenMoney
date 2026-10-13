import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./login/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', loadComponent: () => import('./movements/movements').then((m) => m.Movements) },
      { path: 'statistiche', loadComponent: () => import('./stats/stats').then((m) => m.Stats) },
      { path: 'budget', loadComponent: () => import('./budget/budget').then((m) => m.Budget) },
      { path: 'conti', loadComponent: () => import('./accounts/accounts').then((m) => m.Accounts) },
      { path: 'categorie', loadComponent: () => import('./categories/categories').then((m) => m.Categories) },
      { path: 'profilo', loadComponent: () => import('./profile/profile').then((m) => m.Profile) },
    ],
  },
  { path: '**', redirectTo: '' },
];
