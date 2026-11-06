import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-preferences',
  imports: [MatCardModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences.html',
  styleUrl: './preferences.scss',
})
export class Preferences {
  private readonly language = inject(LanguageService);
  protected readonly datePreview = computed(() =>
    this.language.formatExampleDate(new Date('2026-11-06T12:00:00Z')),
  );
  protected readonly numberPreview = computed(() => this.language.formatNumber(12345.67));
}
