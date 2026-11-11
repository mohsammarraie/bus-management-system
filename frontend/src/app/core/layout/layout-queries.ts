import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

// Global SCSS exports the complete queries so CSS and CDK switch at the same width.
export const LAYOUT_QUERIES = new InjectionToken<{ compact: string; navigation: string }>(
  'LAYOUT_QUERIES',
  {
    providedIn: 'root',
    factory: () => {
      const document = inject(DOCUMENT);
      const styles = document.defaultView!.getComputedStyle(document.documentElement);
      const query = (name: string) => {
        const value = styles.getPropertyValue('--app-media-' + name).trim();
        if (!value) throw new Error('Missing global layout query: ' + name);
        return value;
      };
      return { compact: query('compact'), navigation: query('navigation') };
    },
  },
);
