import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
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
    path: '**',
    title: 'notFound.eyebrow',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
