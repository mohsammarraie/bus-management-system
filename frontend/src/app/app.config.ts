import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { PageTitleStrategy } from './core/i18n/page-title.strategy';
import { provideAppTranslations } from './core/i18n/translations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppTranslations(),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
