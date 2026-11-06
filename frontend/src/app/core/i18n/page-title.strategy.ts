import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';

@Injectable()
export class PageTitleStrategy extends TitleStrategy {
  private readonly language = inject(LanguageService);
  private readonly translations = inject(TranslocoService);
  private readonly title = inject(Title);
  private readonly pageKey = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      this.language.language();
      const key = this.pageKey();
      const app = this.translations.translate('app.name');
      this.title.setTitle(key ? `${this.translations.translate(key)} | ${app}` : app);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageKey.set(this.buildTitle(snapshot));
  }
}
