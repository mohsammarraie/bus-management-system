import { DOCUMENT } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { Icon } from '../../shared/icon';
import { LoadingOverlay } from '../../shared/loading-overlay';
import { BusDialog } from './bus-dialog';
import { Bus, BusDialogData, BusDialogMode, BusQuery, BusSort } from './buses.models';
import {
  busEditIdFromParams,
  busQueryFromParams,
  busQueryParams,
  sameBusQuery,
} from './buses-query';
import { BusesPaginator } from './buses-paginator';
import { busesActions, busesFeature } from './buses.state';

@Component({
  selector: 'app-buses-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    Icon,
    LoadingOverlay,
    TranslocoDirective,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: BusesPaginator }],
  templateUrl: './buses-page.html',
  styleUrl: './buses-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusesPage implements OnDestroy {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly dialogs = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly translations = inject(TranslocoService);
  private readonly addButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('addBus', {
    read: ElementRef,
  });
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 699px)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );
  protected readonly language = inject(LanguageService);
  protected readonly rows = this.store.selectSignal(busesFeature.selectRows);
  protected readonly query = this.store.selectSignal(busesFeature.selectQuery);
  protected readonly loading = this.store.selectSignal(busesFeature.selectLoading);
  protected readonly error = this.store.selectSignal(busesFeature.selectError);
  protected readonly total = this.store.selectSignal(busesFeature.selectTotal);
  protected readonly columns = ['registrationNumber', 'capacity', 'active', 'actions'];
  protected readonly filters = inject(FormBuilder).nonNullable.group({
    q: ['', Validators.maxLength(100)],
    active: ['all' as BusQuery['active']],
  });
  private dialogRef?: MatDialogRef<BusDialog, boolean>;
  private successToast?: ReturnType<MatSnackBar['open']>;
  private editId: number | null = null;
  private editOrigin?: { opener: Element | null; menuTrigger?: MatMenuTrigger };
  private dialogClosedByRoute = false;

  constructor() {
    let opened = false;
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = busQueryFromParams(params);
      if (!opened || !sameBusQuery(query, this.query())) {
        this.filters.reset({ q: query.q, active: query.active }, { emitEvent: false });
        // Initialize from the URL before the first fetch. Later navigations reuse this component.
        this.store.dispatch(
          opened ? busesActions.queryChanged({ query }) : busesActions.pageOpened({ query }),
        );
        opened = true;
      }
      this.syncEditDialog(busEditIdFromParams(params));
    });
  }

  protected search(): void {
    this.filters.markAllAsTouched();
    if (this.filters.invalid) return;
    const filters = this.filters.getRawValue();
    this.navigateQuery({ ...this.query(), ...filters, q: filters.q.trim(), page: 0 });
  }

  protected resetFilters(): void {
    this.filters.reset({ q: '', active: 'all' }, { emitEvent: false });
    this.search();
  }

  protected refresh(): void {
    this.store.dispatch(busesActions.refreshRequested());
  }

  protected sortChanged(sort: Sort): void {
    this.navigateQuery({
      ...this.query(),
      page: 0,
      sort: sort.active as BusSort,
      direction: sort.direction === 'desc' ? 'desc' : 'asc',
    });
    void this.announcer.announce(
      this.translations.translate('buses.sorted', {
        field: this.translations.translate(
          'buses.' +
            (sort.active === 'registrationNumber'
              ? 'registration'
              : sort.active === 'active'
                ? 'status'
                : 'capacity'),
        ),
        direction: this.translations.translate('buses.' + sort.direction),
      }),
    );
  }

  protected pageChanged(page: PageEvent): void {
    this.navigateQuery({ ...this.query(), page: page.pageIndex, size: page.pageSize });
  }

  private navigateQuery(query: BusQuery): void {
    // Reapplying the current query is an explicit refresh, not a duplicate history entry.
    const unchanged = sameBusQuery(query, this.query());
    if (unchanged) {
      this.filters.reset({ q: query.q, active: query.active }, { emitEvent: false });
      this.refresh();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: busQueryParams(query),
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: unchanged,
    });
  }

  protected openDialog(
    mode: BusDialogMode,
    bus: Bus | null = null,
    event?: Event,
    menuTrigger?: MatMenuTrigger,
  ): void {
    if (this.dialogRef) return;
    menuTrigger?.closeMenu();
    const opener =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : this.document.activeElement;
    if (mode === 'edit' && bus) {
      this.editOrigin = { opener, menuTrigger };
      this.navigateEdit(bus.id);
      return;
    }
    this.showDialog(mode, bus, opener, menuTrigger);
  }

  private navigateEdit(id: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: id },
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: id === null,
    });
  }

  private syncEditDialog(id: number | null): void {
    if (id === this.editId) return;
    this.editId = id;
    const open = () => {
      // A newer navigation may have replaced this selection while the old dialog was closing.
      if (id === null || id !== this.editId) return;
      const origin = this.editOrigin;
      this.editOrigin = undefined;
      this.showDialog('edit', null, origin?.opener ?? null, origin?.menuTrigger, id);
    };
    if (this.dialogRef) {
      this.dialogRef
        .afterClosed()
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(open);
      this.dialogClosedByRoute = true;
      this.dialogRef.close();
    } else open();
  }

  private showDialog(
    mode: BusDialogMode,
    bus: Bus | null,
    opener: Element | null,
    menuTrigger?: MatMenuTrigger,
    id?: number,
  ): void {
    this.successToast?.dismiss();
    this.dialogClosedByRoute = false;
    this.store.dispatch(busesActions.dialogOpened({ bus }));
    if (id !== undefined) this.store.dispatch(busesActions.latestRequested({ id }));
    this.dialogRef = this.dialogs.open<BusDialog, BusDialogData, boolean>(BusDialog, {
      data: { mode, id },
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabelledBy: 'bus-dialog-title',
      ariaDescribedBy: 'bus-dialog-description',
      autoFocus: mode === 'delete' ? '#bus-dialog-cancel' : 'first-tabbable',
      restoreFocus: false,
      closeOnNavigation: mode !== 'edit',
      direction: this.language.direction(),
    });
    this.dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved: boolean | undefined) => {
        this.dialogRef = undefined;
        this.store.dispatch(busesActions.dialogClosed());
        // URL-driven closes already changed the selection; don't overwrite Back/Forward or a new ID.
        if (!this.dialogClosedByRoute && id !== undefined && this.editId === id)
          this.navigateEdit(null);
        // Success refreshes once through the effect. Cancelling keeps the list and scroll intact.
        const target =
          !saved && opener instanceof HTMLElement && opener.isConnected
            ? opener
            : this.addButton()?.nativeElement;
        if (!saved && menuTrigger && this.compact())
          menuTrigger.focus('program', { preventScroll: true });
        else target?.focus({ preventScroll: true });
        if (saved) {
          const operation = mode === 'edit' ? 'update' : mode;
          this.successToast = this.snackBar.open(
            this.translations.translate('buses.saved.' + operation),
            undefined,
            { duration: 6000, politeness: 'polite', direction: this.language.direction() },
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.dialogClosedByRoute = true;
    this.successToast?.dismiss();
    this.dialogRef?.close();
    this.store.dispatch(busesActions.pageLeft());
  }
}
