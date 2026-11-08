import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  return next(request).pipe(
    catchError((error: unknown) => {
      // Our API contract uses relative URLs. Never react to another origin's failures.
      if (request.url.startsWith('/api/') && error instanceof HttpErrorResponse) {
        if (error.status === 401 && request.url !== '/api/auth/me') auth.expireSession();
        if (error.status === 403) auth.showNotice('denied');
      }
      // Never automatically replay a failed mutation or redirect a fetch to the identity provider.
      return throwError(() => error);
    }),
  );
};
