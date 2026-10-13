# Progetto OpenMoney

- Gestione di entrate, uscite, conti e budget della famiglia, sul modello di Money Manager per Android.
- Backend C# (.NET 10) in `src/`, frontend Angular in `web/`, un solo container per app + PostgreSQL (vedi README.md). Stessa impostazione di OpenMeal (`C:\Projects\OpenMeal`): prima di inventare una soluzione, guardare come è fatta lì.
- Architettura a moduli: ogni modulo con dominio (`OpenMoney.Core`), endpoint (`OpenMoney.Api`) e persistenza (`OpenMoney.Infrastructure`) nella propria cartella. Il dominio non dipende da framework, database o API esterne.
- Porte e adapter solo per le sorgenti esterne (file delle banche, backup di Money Manager). Niente MediatR, AutoMapper, repository generici sopra EF Core.
- Un'installazione è una famiglia: gli utenti li crea solo l'amministratore (il primo account), non c'è registrazione libera.
- Solo euro. UI e messaggi all'utente solo in italiano, scritti direttamente nei componenti (niente dizionario i18n).
- Test: solo unit test su dominio e casi d'uso, senza database.
