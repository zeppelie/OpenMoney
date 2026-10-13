import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  // inject() è valido solo prima del primo await.
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.load()) ? true : router.createUrlTree(['/login']);
};
