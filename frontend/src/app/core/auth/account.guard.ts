import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApplicationRole, AuthService } from './auth.service';

export function requireAccount(...roles: ApplicationRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.refresh().pipe(
      map((account) => {
        if (account && (!roles.length || auth.hasAnyRole(...roles))) return true;
        if (account) auth.showNotice('forbidden');
        else if (auth.state().status === 'anonymous' && auth.notice() !== 'expired')
          auth.showNotice('loginRequired');
        return router.parseUrl('/overview');
      }),
    );
  };
}
