import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { sessionInterceptor } from './core/auth/session.interceptor';
import { PageTitleStrategy } from './core/i18n/page-title.strategy';
import { provideAppTranslations } from './core/i18n/translations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideAppTranslations(),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
