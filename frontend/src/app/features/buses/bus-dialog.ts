import { BidiModule } from '@angular/cdk/bidi';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoDirective } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { LanguageService } from '../../core/i18n/language.service';
import { Icon } from '../../shared/icon';
import { LoadingOverlay } from '../../shared/loading-overlay';
import { BusDialogData } from './buses.models';
import { busesActions, busesFeature } from './buses.state';

const integer: ValidatorFn = (control) =>
  Number.isInteger(control.value) ? null : { integer: true };

@Component({
  selector: 'app-bus-dialog',
  imports: [
    BidiModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoDirective,
    Icon,
    LoadingOverlay,
  ],
  templateUrl: './bus-dialog.html',
  styleUrl: './bus-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusDialog {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialogRef<BusDialog, boolean>);
  private readonly data = inject<BusDialogData>(MAT_DIALOG_DATA);
  private readonly injector = inject(Injector);
  private readonly registrationInput = viewChild<ElementRef<HTMLInputElement>>('registrationInput');
  protected readonly mode = this.data.mode;
  protected readonly language = inject(LanguageService);
  protected readonly bus = this.store.selectSignal(busesFeature.selectSelectedBus);
  protected readonly mutation = this.store.selectSignal(busesFeature.selectMutation);
  protected readonly error = this.store.selectSignal(busesFeature.selectMutationError);
  protected readonly busy = computed(() => ['saving', 'reloading'].includes(this.mutation()));
  protected readonly saving = computed(() => this.mutation() === 'saving');
  private focusOnLoad = this.mode === 'edit';
  protected readonly blocked = computed(
    () =>
      this.busy() ||
      (this.mode === 'edit' && !this.bus()) ||
      [
        'BUS_VERSION_CONFLICT',
        'BUS_NOT_FOUND',
        'UNAVAILABLE',
        'AUTHENTICATION_REQUIRED',
        'ACCESS_DENIED',
      ].includes(this.error()?.code ?? ''),
  );
  protected readonly form = inject(FormBuilder).nonNullable.group({
    registrationNumber: [
      '',
      [
        Validators.required,
        Validators.maxLength(32),
        Validators.pattern(/^[^\s\p{Cc}](?:[^\p{Cc}]*[^\s\p{Cc}])?$/u),
      ],
    ],
    capacity: [40, [Validators.required, Validators.min(1), Validators.max(2147483647), integer]],
    active: [true],
  });

  constructor() {
    effect(() => {
      const bus = this.bus();
      if (bus) {
        this.form.reset({
          registrationNumber: bus.registrationNumber,
          capacity: bus.capacity,
          active: bus.active,
        });
        if (this.focusOnLoad) {
          this.focusOnLoad = false;
          afterNextRender(
            () => this.registrationInput()?.nativeElement.focus({ preventScroll: true }),
            {
              injector: this.injector,
            },
          );
        }
      }
    });
    effect(() => {
      this.dialog.disableClose = this.saving();
      if (this.mutation() === 'succeeded') this.dialog.close(true);
    });
  }

  protected fieldError(field: 'registrationNumber' | 'capacity'): string {
    const errors = this.form.controls[field].errors;
    if (errors?.['required']) return 'REQUIRED';
    if (errors?.['maxlength']) return 'TOO_LONG';
    if (errors?.['pattern']) return 'FORMAT';
    if (errors?.['min']) return 'POSITIVE';
    if (errors?.['max']) return 'MAX_VALUE';
    return 'INTEGER';
  }

  protected submit(): void {
    if (this.blocked()) return;
    const bus = this.bus();
    if (this.mode === 'delete' && bus) {
      this.store.dispatch(busesActions.saveRequested({ command: { kind: 'delete', bus } }));
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const draft = this.form.getRawValue();
    this.store.dispatch(
      busesActions.saveRequested({
        command:
          this.mode === 'create' ? { kind: 'create', draft } : { kind: 'update', bus: bus!, draft },
      }),
    );
  }

  protected reloadLatest(): void {
    const id = this.bus()?.id ?? this.data.id;
    if (id !== undefined && !this.busy()) this.store.dispatch(busesActions.latestRequested({ id }));
  }
}
