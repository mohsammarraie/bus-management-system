import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_COOKIE = 'bus-management.appearance';

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<ThemePreference>('system');
  readonly preference = this.selected.asReadonly();

  constructor() {
    let saved: unknown;
    try {
      saved = this.document.cookie
        .split('; ')
        .find((item) => item.startsWith(`${THEME_COOKIE}=`))
        ?.split('=')[1];
    } catch {
      // Appearance still works for this page when persistence is unavailable.
    }
    this.apply(isThemePreference(saved) ? saved : 'system');
  }

  select(value: unknown): void {
    if (!isThemePreference(value)) return;
    this.apply(value);
    try {
      const secure = this.document.location.protocol === 'https:' ? '; Secure' : '';
      // Host-only, shared across localhost ports; contains no identity or authentication data.
      this.document.cookie = `${THEME_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // Browser restrictions must not prevent an in-memory selection.
    }
  }

  private apply(value: ThemePreference): void {
    this.selected.set(value);
    this.document.documentElement.dataset['theme'] = value;
  }
}
