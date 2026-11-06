import { BidiModule } from '@angular/cdk/bidi';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { map } from 'rxjs';
import { LanguageService } from './core/i18n/language.service';
import { Icon } from './shared/icon';
import { LanguageSwitcher } from './shared/language-switcher';

@Component({
  selector: 'app-root',
  imports: [
    BidiModule,
    MatButtonModule,
    MatListModule,
    MatSidenavModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoDirective,
    Icon,
    LanguageSwitcher,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly language = inject(LanguageService);
  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  private readonly injector = inject(Injector);
  private hasActivatedPage = false;
  private menuClosed: Promise<unknown> = Promise.resolve();

  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }

  protected async navigateFromMenu(drawer: MatSidenav, main: HTMLElement): Promise<void> {
    this.menuClosed = this.handset() ? drawer.close() : Promise.resolve();
    await this.menuClosed;
    if (this.handset()) this.focusPageHeading(main);
  }

  protected async focusNewPage(main: HTMLElement): Promise<void> {
    // Keep the initial Tab order; move focus only after in-app route navigation.
    if (!this.hasActivatedPage) {
      this.hasActivatedPage = true;
      return;
    }
    await this.menuClosed;
    this.focusPageHeading(main);
  }

  private focusPageHeading(main: HTMLElement): void {
    afterNextRender(() => main.querySelector<HTMLElement>('h1')?.focus(), {
      injector: this.injector,
    });
  }
}
