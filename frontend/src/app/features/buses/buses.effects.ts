import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, switchMap, takeUntil, withLatestFrom } from 'rxjs';
import { BusesApi } from './buses.api';
import { busFailure } from './buses.models';
import { busesActions, busesFeature } from './buses.state';

@Injectable()
export class BusesEffects {
  private readonly actions = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(BusesApi);

  readonly load = createEffect(() =>
    this.actions.pipe(
      ofType(
        busesActions.pageOpened,
        busesActions.queryChanged,
        busesActions.refreshRequested,
        busesActions.saveSucceeded,
      ),
      withLatestFrom(this.store.select(busesFeature.selectQuery)),
      // A new query supersedes an old read. Writes use their own exhaustMap below.
      switchMap(([, query]) =>
        this.api.list(query).pipe(
          map((page) =>
            page.content.length === 0 && query.page > 0
              ? busesActions.queryChanged({
                  query: { ...query, page: Math.max(0, page.totalPages - 1) },
                })
              : busesActions.loadSucceeded({ page }),
          ),
          catchError((error: unknown) => of(busesActions.loadFailed({ error: busFailure(error) }))),
          takeUntil(this.actions.pipe(ofType(busesActions.pageLeft))),
        ),
      ),
    ),
  );

  readonly save = createEffect(() =>
    this.actions.pipe(
      ofType(busesActions.saveRequested),
      exhaustMap(({ command }) =>
        this.api.save(command).pipe(
          map(() => busesActions.saveSucceeded({ kind: command.kind })),
          catchError((error: unknown) => of(busesActions.saveFailed({ error: busFailure(error) }))),
          takeUntil(this.actions.pipe(ofType(busesActions.pageLeft))),
        ),
      ),
    ),
  );

  readonly latest = createEffect(() =>
    this.actions.pipe(
      ofType(busesActions.latestRequested),
      switchMap(({ id }) =>
        this.api.get(id).pipe(
          map((bus) => busesActions.latestLoaded({ bus })),
          catchError((error: unknown) =>
            of(busesActions.latestFailed({ error: busFailure(error) })),
          ),
          takeUntil(this.actions.pipe(ofType(busesActions.dialogClosed, busesActions.pageLeft))),
        ),
      ),
    ),
  );
}
