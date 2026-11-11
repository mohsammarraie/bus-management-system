import { BidiModule } from '@angular/cdk/bidi';
import { BreakpointObserver } from '@angular/cdk/layout';
import { LAYOUT_QUERIES } from './core/layout/layout-queries';
import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  HostListener,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { AccountControls } from './shared/account-controls';
import { LanguageService } from './core/i18n/language.service';
import { Icon } from './shared/icon';
import { LanguageSwitcher } from './shared/language-switcher';
import { LoadingOverlay } from './shared/loading-overlay';

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
    AccountControls,
    LoadingOverlay,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  protected readonly navigating = computed(() => this.router.currentNavigation() !== null);
  protected readonly language = inject(LanguageService);
  protected readonly auth = inject(AuthService);
  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe(inject(LAYOUT_QUERIES).navigation)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  private readonly injector = inject(Injector);
  private hasActivatedPage = false;
  private menuClosed: Promise<unknown> = Promise.resolve();

  constructor() {
    this.auth.refresh().subscribe();
    const router = this.router;
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (router.parseUrl(router.url).queryParams['auth'] === 'failed')
          this.auth.showNotice('loginFailed');
      });
  }

  @HostListener('window:pageshow', ['$event'])
  protected restorePage(event: PageTransitionEvent): void {
    if (event.persisted) this.auth.resume().subscribe();
  }

  protected retrySession(): void {
    this.auth.refresh().subscribe();
  }

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
