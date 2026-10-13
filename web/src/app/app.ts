import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const updates = inject(SwUpdate);
    const snackBar = inject(MatSnackBar);

    // L'app installata usa la versione salvata sul telefono: quando sul server ce n'è una nuova, lo si dice.
    updates.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() =>
        snackBar
          .open('È disponibile una nuova versione', 'Aggiorna')
          .onAction()
          .subscribe(() => document.location.reload()),
      );
  }
}
