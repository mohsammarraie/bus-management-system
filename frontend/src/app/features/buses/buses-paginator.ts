import { effect, inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';

@Injectable()
export class BusesPaginator extends MatPaginatorIntl {
  private readonly language = inject(LanguageService);
  private readonly translations = inject(TranslocoService);

  constructor() {
    super();
    effect(() => {
      this.language.language();
      this.itemsPerPageLabel = this.translations.translate('buses.paging.size');
      this.nextPageLabel = this.translations.translate('buses.paging.next');
      this.previousPageLabel = this.translations.translate('buses.paging.previous');
      this.firstPageLabel = this.translations.translate('buses.paging.first');
      this.lastPageLabel = this.translations.translate('buses.paging.last');
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, size: number, total: number): string => {
    const start = total === 0 ? 0 : page * size + 1;
    return this.translations.translate('buses.paging.range', {
      start: this.language.formatNumber(start),
      end: this.language.formatNumber(Math.min((page + 1) * size, total)),
      total: this.language.formatNumber(total),
    });
  };
}
