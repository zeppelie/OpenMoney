import { HttpErrorResponse } from '@angular/common/http';

const unexpected = 'Qualcosa è andato storto. Riprova.';

/** Messaggi per i codici d'errore del server (in gran parte quelli di ASP.NET Identity). */
const messages: Record<string, string> = {
  invalidCredentials: 'Email o password non corrette.',
  setupClosed: "L'amministratore esiste già: accedi con il tuo account.",
  PasswordTooShort: 'La password deve avere almeno 6 caratteri.',
  PasswordRequiresNonAlphanumeric: 'La password deve contenere almeno un simbolo.',
  PasswordRequiresDigit: 'La password deve contenere almeno una cifra.',
  PasswordRequiresLower: 'La password deve contenere almeno una lettera minuscola.',
  PasswordRequiresUpper: 'La password deve contenere almeno una lettera maiuscola.',
  PasswordMismatch: 'La password attuale non è corretta.',
  DuplicateUserName: 'Esiste già un utente con questa email.',
  DuplicateEmail: 'Esiste già un utente con questa email.',
  InvalidEmail: "L'indirizzo email non è valido.",
  InvalidUserName: "L'indirizzo email non è valido.",
  DisplayNameTooLong: 'Il nome è troppo lungo (massimo 100 caratteri).',
  CannotDeleteSelf: 'Non puoi eliminare il tuo account.',
  InvalidName: 'Il nome è obbligatorio (massimo 60 caratteri).',
  InvalidAmount: "L'importo non è valido.",
  InvalidDate: 'La data non è valida.',
  NoteTooLong: 'La nota è troppo lunga (massimo 200 caratteri).',
  MissingCategory: 'Scegli una categoria.',
  CategoryKindMismatch: 'La categoria non è del tipo giusto.',
  MissingToAccount: 'Scegli il conto di destinazione.',
  SameAccount: 'I due conti devono essere diversi.',
  UnknownAccount: 'Il conto non esiste più.',
  AccountInUse: 'Il conto ha dei movimenti: non si può eliminare.',
  CategoryInUse: 'La categoria ha dei movimenti: non si può eliminare.',
  CategoryHasChildren: 'Elimina o sposta prima le sottocategorie.',
  InvalidParentCategory: 'La categoria superiore non è valida.',
  InvalidBudgetCategory: 'Il budget si imposta solo sulle categorie di uscita principali.',
  InvalidSettlement: "Per l'addebito automatico servono un conto e un giorno tra 1 e 28.",
  InvalidFrequency: 'Scegli ogni quanto ripetere il movimento.',
  InvalidOccurrences: 'Il numero di volte deve essere tra 1 e 600.',
  InvalidEndDate: 'La data di fine non può venire prima della prima data.',
  RecurrenceScheduleLocked: 'Prima data e frequenza di una ricorrenza non si possono cambiare.',
  CategoryKindLocked: 'Il tipo di una categoria esistente non si può cambiare.',
};

/**
 * Converte un errore HTTP in messaggi per l'utente.
 * `byStatus` associa uno stato HTTP a un codice (es. 401 al login).
 */
export function errorMessages(e: unknown, byStatus: Record<number, string> = {}): string[] {
  if (!(e instanceof HttpErrorResponse)) return [unexpected];
  if (byStatus[e.status]) return [messages[byStatus[e.status]] ?? unexpected];

  // Il server risponde con { errors: { CodiceErrore: ["descrizione in inglese"] } }.
  const codes = Object.keys((e.error?.errors ?? {}) as Record<string, string[]>);
  const known = [...new Set(codes.map((code) => messages[code]).filter(Boolean))];
  return known.length ? known : [unexpected];
}
