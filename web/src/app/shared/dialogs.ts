import { WritableSignal } from '@angular/core';
import { MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { errorMessages } from './errors';

/** Finestra di inserimento: larga quanto serve su desktop, quasi a tutto schermo sul telefono. */
export function formDialog<D>(data: D): MatDialogConfig<D> {
  return { data, width: '28rem', maxWidth: 'calc(100vw - 1rem)' };
}

/** Esegue il salvataggio (o l'eliminazione) e chiude la finestra con `true`; se fallisce mostra gli errori. */
export async function submitDialog(
  ref: MatDialogRef<unknown, boolean>,
  errors: WritableSignal<string[]>,
  action: () => Promise<unknown>,
): Promise<void> {
  errors.set([]);
  try {
    await action();
    ref.close(true);
  } catch (e) {
    errors.set(errorMessages(e));
  }
}
