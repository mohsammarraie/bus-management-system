import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_COOKIE, ThemeService } from './theme.service';

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  delete document.documentElement.dataset['theme'];
});

describe('appearance preference', () => {
  it.each([null, 'unsupported', 'dark%3Bother=value'])(
    'defaults to system for missing or invalid preference %s',
    (saved) => {
      if (saved) document.cookie = `${THEME_COOKIE}=${saved}; Path=/`;
      const theme = TestBed.inject(ThemeService);
      expect(theme.preference()).toBe('system');
      expect(document.documentElement.dataset['theme']).toBe('system');
    },
  );

  it('restores a saved selection and persists explicit choices including system', () => {
    document.cookie = `${THEME_COOKIE}=dark; Path=/`;
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('dark');
    for (const choice of ['light', 'dark', 'system'] as const) {
      theme.select(choice);
      expect(document.documentElement.dataset['theme']).toBe(choice);
      expect(document.cookie).toContain(`${THEME_COOKIE}=${choice}`);
    }
    theme.select('invalid');
    expect(theme.preference()).toBe('system');
  });

  it('still applies the selection when cookie access is blocked', () => {
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new Error('Cookies blocked');
    });
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('Cookies blocked');
    });
    const theme = TestBed.inject(ThemeService);
    expect(() => theme.select('dark')).not.toThrow();
    expect(theme.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
