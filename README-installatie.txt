INSTALLATIE - RIJBEWIJS B WEBSITE MET MOLLIE PAYWALL

Bestanden:
- index.html: oefensite met 10 gratis vragen en betaalmuur
- betaald.html: controlepagina na Mollie-betaling
- geweigerd.html: eenvoudige pagina voor niet-afgeronde betaling
- functions/api/create-payment.js: maakt Mollie-betaling aan
- functions/api/mollie-webhook.js: ontvangt Mollie-webhook en activeert toegang
- functions/api/check-access.js: controleert of de bezoeker geldige toegang heeft
- schema.sql: database-tabel voor Cloudflare D1

Adviesformule:
- 10 gratis vragen
- daarna €4,95 voor 7 dagen onbeperkte toegang

Cloudflare Pages stappen:
1. Upload deze volledige map naar GitHub.
2. Koppel de GitHub repository aan Cloudflare Pages.
3. Maak in Cloudflare een D1 database aan, bv. rijbewijs_db.
4. Voer schema.sql uit in de D1 database.
5. Ga bij je Pages project naar Settings > Functions > D1 database bindings.
6. Voeg binding toe met naam: DB
7. Koppel deze aan je D1 database.
8. Ga naar Settings > Environment variables.
9. Voeg toe:
   MOLLIE_API_KEY = jouw Mollie API-key, bv. test_xxx of live_xxx
   SITE_URL = https://jouwdomein.be
10. Deploy opnieuw.
11. Test eerst met een test API-key van Mollie.

Belangrijk:
- Zet je Mollie API-key nooit in index.html.
- De API-key hoort enkel in Cloudflare Environment Variables.
- De 7 dagen toegang kan je aanpassen in functions/api/check-access.js en functions/api/mollie-webhook.js bij ACCESS_HOURS.
- Wil je toch 48 uur toegang, verander ACCESS_HOURS naar 48.


Update duidelijke vragen
------------------------
Alle zichtbare vragen zijn herschreven in gewone taal. Artikelnummers zoals 7ter, 22bis of 40ter worden niet meer in de vraag getoond. Ze blijven enkel intern in de code als bronverwijzing naar de meegeleverde wegcode.


EXTRA CONTROLE BIJ FOUTEN
Open na deployment: https://jouw-site.pages.dev/api/ping
Je moet JSON zien met ok:true. Als je 404 krijgt, staat de functions-map niet op de juiste plaats of is de GitHub-root verkeerd ingesteld.
Deze versie gebruikt PUBLIC_SITE_URL. SITE_URL werkt ook nog als fallback.

405-fix:
Deze versie ondersteunt zowel GET als POST op /api/create-payment, zodat Cloudflare geen 405-fout meer geeft wanneer de betaalknop de betaling start.
