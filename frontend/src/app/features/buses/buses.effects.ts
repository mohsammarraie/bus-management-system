import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { catchError, exhaustMap, map, of, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';
import { BusesApi } from './buses.api';
import { busFailure } from './buses.models';
import { busQueryParams } from './buses-query';
import { busesActions, busesFeature } from './buses.state';

@Injectable()
export class BusesEffects {
  private readonly actions = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(BusesApi);
  private readonly router = inject(Router);

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
              ? busesActions.pageCorrectionRequested({
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

  readonly correctPage = createEffect(
    () =>
      this.actions.pipe(
        ofType(busesActions.pageCorrectionRequested),
        tap(({ query }) => {
          // Let the route apply the corrected query and fetch once; don't keep an empty page in history.
          void this.router.navigate(['/buses'], {
            queryParams: busQueryParams(query),
            queryParamsHandling: 'merge',
            preserveFragment: true,
            replaceUrl: true,
          });
        }),
      ),
    { dispatch: false },
  );

  readonly save = createEffect(() =>
    this.actions.pipe(
      ofType(busesActions.saveRequested),
      exhaustMap(({ command }) =>
        this.api.save(command).pipe(
          map(() => busesActions.saveSucceeded({ kind: command.kind })),
          catchError((error: unknown) => of(busesActions.saveFailed({ error: busFailure(error) }))),
          takeUntil(this.actions.pipe(ofType(busesActions.dialogClosed, busesActions.pageLeft))),
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
