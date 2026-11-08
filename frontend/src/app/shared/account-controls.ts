import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/i18n/language.service';

@Component({
  selector: 'app-account-controls',
  imports: [MatButtonModule, RouterLink, TranslocoDirective],
  templateUrl: './account-controls.html',
  styleUrl: './account-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountControls {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected logout(event: Event, form: HTMLFormElement, csrfInput: HTMLInputElement): void {
    event.preventDefault();
    this.auth
      .prepareLogout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => {
        try {
          // Set the declared input before native submission; no render timing dependency.
          csrfInput.value = token;
          // submit() bypasses this handler so the browser can follow the OIDC redirects.
          form.submit();
        } catch {
          this.auth.logoutFailed();
        }
      });
  }
}
