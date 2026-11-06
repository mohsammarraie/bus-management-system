import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { isLanguage, Language } from './translations';

export const LANGUAGE_STORAGE_KEY = 'bus-management.language';
export type LanguageStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const LANGUAGE_STORAGE = new InjectionToken<LanguageStorage | null>('Language storage', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly translations = inject(TranslocoService);
  private readonly storage = inject(LANGUAGE_STORAGE);
  private readonly selected = signal<Language>('en');
  readonly language = this.selected.asReadonly();
  readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));
  readonly locale = computed(() => ({ en: 'en-GB', de: 'de-DE', ar: 'ar-JO' })[this.language()]);

  constructor() {
    let saved: unknown;
    try {
      saved = this.storage?.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      saved = null;
    }
    this.select(isLanguage(saved) ? saved : 'en');
  }

  select(language: Language): void {
    // Bundled dictionaries load synchronously; selection is committed only after a successful load.
    this.translations
      .load(language)
      .pipe(take(1))
      .subscribe(() => {
        this.translations.setActiveLang(language);
        this.selected.set(language);
        this.document.documentElement.lang = language;
        this.document.documentElement.dir = this.direction();
        try {
          this.storage?.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
          /* Optional preference storage. */
        }
      });
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale()).format(value);
  }

  formatExampleDate(value: Date): string {
    return new Intl.DateTimeFormat(this.locale(), { dateStyle: 'long', timeZone: 'UTC' }).format(
      value,
    );
  }
}
