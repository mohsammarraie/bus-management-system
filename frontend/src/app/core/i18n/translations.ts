import { isDevMode, Injectable } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import en from './messages/en.json';
import de from './messages/de.json';
import ar from './messages/ar.json';

export const LANGUAGES = ['en', 'de', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];
export const TRANSLATIONS = { en, de, ar };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.some((language) => language === value);
}

@Injectable({ providedIn: 'root' })
export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(language: string) {
    return of<Translation>(TRANSLATIONS[isLanguage(language) ? language : 'en']);
  }
}

export function provideAppTranslations() {
  return provideTransloco({
    config: {
      availableLangs: [...LANGUAGES],
      defaultLang: 'en',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: BundledTranslationLoader,
  });
}
