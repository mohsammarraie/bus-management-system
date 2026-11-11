import { Routes } from '@angular/router';
import { requireAccount } from './core/auth/account.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'buses',
    title: 'nav.buses',
    canActivate: [requireAccount('ADMIN')],
    loadChildren: () => import('./features/buses/buses.routes').then((m) => m.BUSES_ROUTES),
  },
  {
    path: 'overview',
    title: 'nav.overview',
    loadComponent: () => import('./features/overview/overview').then((m) => m.Overview),
  },
  {
    path: 'preferences',
    title: 'preferences.title',
    loadComponent: () => import('./features/preferences/preferences').then((m) => m.Preferences),
  },
  {
    path: 'account',
    title: 'auth.pages.account.title',
    data: { area: 'account' },
    canActivate: [requireAccount()],
    loadComponent: () => import('./features/account/account').then((m) => m.AccountPage),
  },
  {
    path: 'administration',
    title: 'auth.pages.admin.title',
    data: { area: 'admin' },
    canActivate: [requireAccount('ADMIN')],
    loadComponent: () => import('./features/account/account').then((m) => m.AccountPage),
  },
  {
    path: 'driver',
    title: 'auth.pages.driver.title',
    data: { area: 'driver' },
    canActivate: [requireAccount('ADMIN', 'DRIVER')],
    loadComponent: () => import('./features/account/account').then((m) => m.AccountPage),
  },
  {
    path: '**',
    title: 'notFound.eyebrow',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
