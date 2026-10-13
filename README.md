# OpenMoney

Alternativa self-hosted a Money Manager: entrate, uscite, conti e budget della famiglia.

- Backend: ASP.NET Core (.NET 10) + Identity + PostgreSQL
- Frontend: Angular (`web/`), servito dallo stesso container dell'API; è una PWA installabile sul telefono
- Distribuzione: Docker (un container `app` + un container `db`)

## Stato: login e utenti della famiglia, conti, categorie, movimenti

- Conti raggruppati (contanti, banca, carte, risparmi, investimenti, prestiti): il saldo si calcola da saldo iniziale e movimenti, e la pagina mostra attività, passività e totale.
- Categorie di entrata e di uscita con un livello di sottocategorie; un'installazione nuova parte con le più comuni.
- Movimenti: entrate, uscite e trasferimenti tra conti, visti per giorni, sul calendario del mese e nel riepilogo dell'anno. I trasferimenti non contano nei totali di entrate e uscite.
- Conti, categorie e movimenti sono condivisi da tutta la famiglia; ogni movimento ricorda chi l'ha inserito.

- Al primo avvio chi apre l'app crea l'account dell'amministratore; poi gli altri utenti li aggiunge lui da **Profilo → Utenti**. Non c'è registrazione libera.
- Sessione con cookie HttpOnly (nessun token da gestire nel frontend). Con "Resta collegato" dura tre mesi dall'ultimo utilizzo.
- Non c'è il recupero della password via email: la reimposta l'amministratore da **Profilo → Utenti**.

## Primo avvio

1. `cp .env.example .env` e scegli la password del database.
2. `docker compose up -d --build --wait`
3. Apri http://localhost:8090 e crea l'account dell'amministratore.

Le porte sono diverse da quelle di OpenMeal, così le due app convivono sullo stesso PC: app su 8090 (`APP_PORT` nel `.env`), database su 5434.

Le migrazioni (in `src/OpenMoney.Infrastructure/Migrations`) vengono applicate in automatico all'avvio dell'API. Per aggiungerne una nuova: `dotnet ef migrations add <Nome> --project src/OpenMoney.Infrastructure --startup-project src/OpenMoney.Api` (serve `dotnet tool restore`, una volta sola).

**Aggiornare:** `git pull && docker compose up -d --build --wait`.

**Installare sul telefono:** su Android (Chrome) menu ⋮ → "Installa app". Il browser lo permette solo se l'app è raggiunta in HTTPS: con il semplice `http://<nome-del-pc>:8090` si può solo aggiungere un collegamento alla schermata Home.

## Da Visual Studio

Imposta `OpenMoney.Api` come progetto di avvio e scegli il profilo **Docker Compose (tutto)**; per fermare, **Docker Compose (stop)** o `docker compose down`.

## Sviluppo senza ricostruire l'immagine

Con `POSTGRES_PASSWORD=openmoney` nel `.env` (è la password di `appsettings.json`):

```
docker compose up db -d
dotnet run --project src/OpenMoney.Api      # http://localhost:5090
cd web && npm install && npm start          # http://localhost:4200, /api passa al backend
```

## Backup del database

```
docker compose exec -T db pg_dump -U openmoney openmoney | gzip > openmoney-$(date +%F).sql.gz
```

## Struttura

- `src/OpenMoney.Core`: dominio, senza dipendenze da framework o database
- `src/OpenMoney.Infrastructure`: EF Core e PostgreSQL
- `src/OpenMoney.Api`: endpoint e configurazione
- `web/`: app Angular
