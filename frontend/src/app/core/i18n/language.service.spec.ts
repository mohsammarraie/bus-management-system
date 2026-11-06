import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageService, LANGUAGE_STORAGE, LANGUAGE_STORAGE_KEY } from './language.service';
import { provideAppTranslations, TRANSLATIONS } from './translations';

function setup(saved: string | null = null, blocked = false) {
  const storage = {
    getItem: vi.fn(() => {
      if (blocked) throw new Error('Storage blocked');
      return saved;
    }),
    setItem: vi.fn(() => {
      if (blocked) throw new Error('Storage blocked');
    }),
  };
  TestBed.configureTestingModule({
    providers: [provideAppTranslations(), { provide: LANGUAGE_STORAGE, useValue: storage }],
  });
  return {
    language: TestBed.inject(LanguageService),
    translations: TestBed.inject(TranslocoService),
    storage,
  };
}

afterEach(() => {
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

describe('language preference', () => {
  it('starts in English on a first visit', () => {
    const { language } = setup();
    expect(language.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
  it('restores a supported saved choice with translated content', () => {
    const { language, translations } = setup('de');
    expect(language.language()).toBe('de');
    expect(translations.translate('nav.preferences')).toBe('Einstellungen');
    expect(document.documentElement.lang).toBe('de');
  });
  it('falls back to English for an unsupported saved value', () => {
    const { language } = setup('fr');
    expect(language.language()).toBe('en');
  });
  it('switches to Arabic, updates document accessibility and persists the selection', () => {
    const { language, translations, storage } = setup();
    language.select('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(translations.translate('nav.overview')).toBe('نظرة عامة');
    expect(storage.setItem).toHaveBeenLastCalledWith(LANGUAGE_STORAGE_KEY, 'ar');
    language.select('de');
    expect(document.documentElement.dir).toBe('ltr');
  });
  it('still switches language when preference storage is blocked', () => {
    const { language } = setup(null, true);
    expect(() => language.select('ar')).not.toThrow();
    expect(language.language()).toBe('ar');
  });
  it('formats example values for the chosen locale', () => {
    const { language } = setup();
    expect(language.formatNumber(12345.67)).toBe('12,345.67');
    language.select('de');
    expect(language.formatNumber(12345.67)).toBe('12.345,67');
    expect(language.formatExampleDate(new Date('2026-11-06T12:00:00Z'))).toBe('6. November 2026');
    language.select('ar');
    expect(language.formatNumber(12345.67)).toBe('١٢٬٣٤٥٫٦٧');
  });
});

function translationKeys(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === 'object' && child !== null) return translationKeys(child, path);
      expect(typeof child).toBe('string');
      expect(String(child).trim().length).toBeGreaterThan(0);
      return [path];
    })
    .sort();
}

describe('translation completeness', () => {
  it.each(['de', 'ar'] as const)(
    'includes every English key with nonempty text in %s',
    (language) => {
      expect(translationKeys(TRANSLATIONS[language])).toEqual(translationKeys(TRANSLATIONS.en));
    },
  );
});
