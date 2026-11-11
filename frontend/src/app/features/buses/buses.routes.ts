import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { BusesApi } from './buses.api';
import { BusesEffects } from './buses.effects';
import { busesFeature } from './buses.state';

export const BUSES_ROUTES: Routes = [
  {
    path: '',
    providers: [BusesApi, provideState(busesFeature), provideEffects(BusesEffects)],
    loadComponent: () => import('./buses-page').then((m) => m.BusesPage),
  },
];
