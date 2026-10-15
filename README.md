# OpenMoney

Alternativa self-hosted a Money Manager: entrate, uscite, conti e budget della famiglia.

- Backend: ASP.NET Core (.NET 10) + Identity + PostgreSQL
- Frontend: Angular (`web/`), servito dallo stesso container dell'API; è una PWA installabile sul telefono
- Distribuzione: Docker (un container `app` + un container `db`)

## Stato: login e utenti della famiglia, conti, categorie, movimenti, statistiche, budget, ricorrenze, carte

- Conti raggruppati (contanti, banca, carte, risparmi, investimenti, prestiti): il saldo si calcola da saldo iniziale e movimenti, e la pagina mostra attività, passività e totale.
- Categorie di entrata e di uscita con un livello di sottocategorie; un'installazione nuova parte con le più comuni.
- Movimenti: entrate, uscite e trasferimenti tra conti, visti per giorni, sul calendario del mese, per settimane e nel riepilogo dell'anno. I trasferimenti non contano nei totali di entrate e uscite.
- Statistiche: quote di entrate o uscite del mese per categoria (le sottocategorie confluiscono nella loro categoria) e andamento dei dodici mesi dell'anno.
- Budget: un importo mensile per categoria di uscita, confrontato con quanto si è speso nel mese.
- Ricorrenze e rate: nel modulo di un movimento "Ripeti" lo fa tornare ogni settimana, mese o anno; con un numero di volte è un piano di rate (l'importo è quello di ogni rata). I movimenti maturati li crea l'app, all'avvio e poi ogni ora; l'elenco è in **Ricorrenze** (dal Profilo, sul telefono).
- Carte di credito a saldo: indicando su una carta il conto e il giorno di addebito, ogni mese l'app registra da sola il trasferimento che salda le spese del mese solare precedente. Collegando una carta si parte dal primo estratto il cui addebito non è ancora passato.
- Ricerca (la lente nella pagina dei movimenti): per testo della nota, periodo, conto, categoria e tipo. Il risultato si esporta in CSV, nel formato che Excel in italiano apre direttamente.
- Modelli: nel modulo di un movimento "Salva come modello" ricorda tipo, conto, categoria, nota e (se c'è) importo; "Da un modello" li ricompila. Si eliminano dal Profilo.
- Scontrini: a ogni movimento si allegano foto (JPEG, PNG, WebP, HEIC) o PDF fino a 10 MB; sul telefono "Allega scontrino" propone anche la fotocamera. I file stanno nel volume Docker `attachments`, fuori dal database.
- Patrimonio (dalla pagina Conti, o nella colonna a sinistra su desktop): una rilevazione al mese fotografa il valore degli investimenti, divisi per gestore (Intesa, Azimut, Gestito da me…), e il saldo dei conti. Gestito più conti fa il totale; previdenza e mutuo residuo stanno a parte e il netto li comprende. La nuova rilevazione parte dai valori della volta prima e dai saldi calcolati da OpenMoney, correggibili. Se nel mese non c'è ancora una rilevazione, la pagina lo ricorda.
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

## Pubblicazione dietro Caddy (HTTPS)

Con `docker-compose.prod.yml` il database non è raggiungibile da fuori e l'app ascolta solo su `127.0.0.1:8095` (`APP_PORT` nel `.env` per cambiarla): ci si arriva solo dal proxy, che termina l'HTTPS.

```
git clone https://github.com/zeppelie/OpenMoney.git && cd OpenMoney
echo "POSTGRES_PASSWORD=<password lunga e casuale>" > .env
docker compose -f docker-compose.prod.yml up -d --build --wait
curl -s http://127.0.0.1:8095/api/auth/status      # atteso al primo avvio: {"setupRequired":true}
```

Nel Caddyfile, poi ricaricare Caddy:

```
openmoney.esempio.it {
    reverse_proxy 127.0.0.1:8095
}
```

Se Caddy gira in un container, `127.0.0.1` è il container stesso: collega il servizio `app` alla rete Docker di Caddy con un `docker-compose.override.yml` (rete dichiarata `external` e `container_name` fisso) e usa `reverse_proxy <nome-del-container>:8080`. Da quel momento aggiungi `-f docker-compose.override.yml` a ogni comando `docker compose`.

Apri l'indirizzo HTTPS e crea subito l'account dell'amministratore: finché non esiste, chiunque raggiunga il sito può crearlo. Verifica nel browser che il cookie `.AspNetCore.Identity.Application` sia marcato `Secure`.

**Aggiornare:** `git pull && docker compose -f docker-compose.prod.yml up -d --build --wait`.

## Importare uno storico del patrimonio

**Patrimonio → Gestori e posizioni → Importa uno storico** (solo l'amministratore) accetta un file JSON come questo; gestori e posizioni mancanti vengono creati, le date già presenti si saltano:

```json
{
  "snapshots": [
    {
      "date": "2025-03-30",
      "holdings": [
        { "name": "Alpha Bonds", "kind": "Investment", "portfolio": "Intesa", "invested": 10000, "value": 9978.77 },
        { "name": "Fondo integrativo", "kind": "Pension", "portfolio": null, "invested": null, "value": 20925.55 },
        { "name": "Mutuo", "kind": "Debt", "portfolio": null, "invested": null, "value": 142901.36 }
      ],
      "accounts": [{ "name": "Satispay", "balance": 2064.21 }],
      "note": null
    }
  ]
}
```

`kind` è `Investment`, `Pension` o `Debt`; `invested` può mancare (`null`). Un conto con lo stesso nome di un conto di OpenMoney viene collegato a quel conto. Le posizioni nuove assenti dall'ultima rilevazione del file vengono segnate come chiuse.

## Da Visual Studio

Imposta `OpenMoney.Api` come progetto di avvio e scegli il profilo **Docker Compose (tutto)**; per fermare, **Docker Compose (stop)** o `docker compose down`.

## Sviluppo senza ricostruire l'immagine

Con `POSTGRES_PASSWORD=openmoney` nel `.env` (è la password di `appsettings.json`):

```
docker compose up db -d
dotnet run --project src/OpenMoney.Api      # http://localhost:5090
cd web && npm install && npm start          # http://localhost:4200, /api passa al backend
```

## Backup

Database e scontrini allegati vanno salvati insieme (aggiungi `-f docker-compose.prod.yml -f docker-compose.override.yml` sul server):

```
docker compose exec -T db pg_dump -U openmoney openmoney | gzip > openmoney-$(date +%F).sql.gz
docker compose exec -T app tar -czf - -C /attachments . > openmoney-allegati-$(date +%F).tar.gz
```

## Struttura

- `src/OpenMoney.Core`: dominio, senza dipendenze da framework o database
- `src/OpenMoney.Infrastructure`: EF Core e PostgreSQL
- `src/OpenMoney.Api`: endpoint e configurazione
- `web/`: app Angular
