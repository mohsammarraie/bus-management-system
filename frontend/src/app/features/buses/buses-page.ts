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
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { Icon } from '../../shared/icon';
import { LoadingOverlay } from '../../shared/loading-overlay';
import { BusDialog } from './bus-dialog';
import { Bus, BusDialogMode, BusQuery, BusSort } from './buses.models';
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

  constructor() {
    this.store.dispatch(busesActions.pageOpened());
  }

  protected search(): void {
    this.filters.markAllAsTouched();
    if (this.filters.invalid) return;
    this.store.dispatch(
      busesActions.queryChanged({
        query: { ...this.query(), ...this.filters.getRawValue(), page: 0 },
      }),
    );
  }

  protected resetFilters(): void {
    this.filters.reset({ q: '', active: 'all' }, { emitEvent: false });
    this.search();
  }

  protected refresh(): void {
    this.store.dispatch(busesActions.refreshRequested());
  }

  protected sortChanged(sort: Sort): void {
    this.store.dispatch(
      busesActions.queryChanged({
        query: {
          ...this.query(),
          page: 0,
          sort: sort.active as BusSort,
          direction: sort.direction === 'desc' ? 'desc' : 'asc',
        },
      }),
    );
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
    this.store.dispatch(
      busesActions.queryChanged({
        query: { ...this.query(), page: page.pageIndex, size: page.pageSize },
      }),
    );
  }

  protected openDialog(
    mode: BusDialogMode,
    bus: Bus | null = null,
    event?: Event,
    menuTrigger?: MatMenuTrigger,
  ): void {
    if (this.dialogRef) return;
    this.successToast?.dismiss();
    menuTrigger?.closeMenu();
    const opener =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : this.document.activeElement;
    this.store.dispatch(busesActions.dialogOpened({ bus }));
    this.dialogRef = this.dialogs.open<BusDialog, { mode: BusDialogMode }, boolean>(BusDialog, {
      data: { mode },
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabelledBy: 'bus-dialog-title',
      ariaDescribedBy: 'bus-dialog-description',
      autoFocus: mode === 'delete' ? '#bus-dialog-cancel' : 'first-tabbable',
      restoreFocus: false,
      direction: this.language.direction(),
    });
    this.dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved: boolean | undefined) => {
        this.dialogRef = undefined;
        this.store.dispatch(busesActions.dialogClosed());
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
    this.successToast?.dismiss();
    this.dialogRef?.close();
    this.store.dispatch(busesActions.pageLeft());
  }
}
