# Bad Gastein wintersport-PWA — ontwerp

Status: concept ter goedkeuring · 2026-10-18

## 1. Waarom en voor wie

Tien vrienden gaan van **zondag 28 februari t/m zaterdag 6 maart 2027** op wintersport naar
**Panorama Spa Lodges (Das Schiller), Kötschachtaler Straße 5, 5640 Bad Gastein**, direct onder het
dalstation van de Graukogel. De app is het gedeelde dashboard van de groep tijdens de reis.

Op een typische skidag rond 12:00 gebruikt de groep de app voor, in volgorde van belang:
1. **Waar is iedereen?**
2. **Waar gaan we lunchen?** (stemmen + route ernaartoe)
3. **Stemmen op wie wat gaat doen** (vroeg skiën, lunchtijd, après of spa)

Succes = iedereen heeft de app vóór vertrek geïnstalleerd, beslissingen over lunch/après/eten lopen
via de app in plaats van een rommelige groepsapp, en de Soipen-meter levert elke avond gelach op.

## 2. Doelen, niet-doelen, anti-doelen

**Doelen**
- Installeerbare PWA via één gedeelde link, werkt op iPhone (Safari → "Zet op beginscherm") en Android.
- Accounts voor alle 10 deelnemers; 2 admins (de eigenaar en Sjoerd).
- 5 tabs: **Kaart, Berg, AI, Huis, Planning**.
- Volledig **gratis** te draaien (hosting, database, AI, kaarten, weer).

**Niet-doelen (nu)**
- Snelheid meten en snelheidsranking — geschrapt; later eventueel toevoegen. Het datamodel hoeft er
  geen rekening mee te houden.
- Memes / fotofeed.
- Native app (Capacitor/App Store): zonder Apple Developer-account niet verspreidbaar op iPhone.

**Anti-doelen (falen, ook als het technisch werkt)**
- Navigatie die mensen naar een verkeerde of te moeilijke piste stuurt. Navigatie moet zó betrouwbaar
  zijn dat je er blind op kunt varen; bij twijfel liever expliciet "controleer ter plekke" dan stil gokken.
- Verzonnen feiten over het huis. Alles wat niet zeker is staat als **[PLACEHOLDER]**.
- Een app die alleen werkt met bereik: piste-netwerk, routes, huisinfo en menukaarten moeten offline beschikbaar zijn.
- Lege batterij door de app: geen continue GPS als de app op de achtergrond staat (kan ook niet in een PWA).

## 3. Harde beperking: locatie in een PWA

Een PWA krijgt alleen GPS terwijl de app **open is en het scherm aan**. Daarom:
- "Live" locatie = **laatst bekende locatie + tijdstip** ("Sanne · 4 min geleden · bij Stubnerkogelbahn").
- Locatie wordt automatisch gedeeld zolang de app open is (elke ~30 s of bij >25 m verplaatsing),
  plus een knop **"Deel mijn locatie nu"**.
- Knop **"Waar ben je?"** bij een persoon → pushmelding naar die persoon; tikken opent de app en ververst de locatie.
- Locaties ouder dan **2 uur** worden grijs weergegeven; ouder dan 12 uur verborgen.
- Pushmeldingen werken op iPhone alleen als de PWA op het beginscherm staat (iOS 16.4+). De app toont
  een korte installatie-uitleg per platform en blijft in de browser werken zonder push.

## 4. Tabs en functies

### 4.1 Kaart
- Kaart van het Gasteinertal met: stipje per persoon (naam, avatar/initialen, "x min geleden"),
  het huis, liften, pistes (kleur), restaurants/hutten op de berg, après-skibars.
- Tik op een plek → kaartje met naam, type, openingstijden indien bekend, menukaart/link, "Route hierheen".
- Tik op een persoon → laatste locatie, "Waar ben je?", "Route naar deze persoon".
- Filter: personen / restaurants / après / liften.

### 4.2 Berg
- **Live lift- en pistestatus**: per lift open/dicht, per piste open/dicht, met tijd van laatste update
  en altijd een link naar de officiële pagina van Skigastein.
- **Pistekaarten**: de officiële panoramakaarten (Skigastein / Ski amadé) als zoombare afbeelding/PDF, offline gecachet.
- **Weer**: vandaag + komende dagen, voor dal én top (temperatuur, wind, sneeuwval, zicht/bewolking, sneeuwgrens indien beschikbaar).
- **Navigatie over pistes** (zie §5).

### 4.3 AI
- **Soipen-meter** (zie §6): groepsmeter + persoonlijke meter + Soipen-ranking + drankjes loggen.
- **Soipie**: chatbot die alle app-informatie kent (zie §7).

### 4.4 Huis
- Alle informatie over het huis: type accommodatie, wat inbegrepen is, check-in/-out, borg en kosten,
  huisregels, adres + route, contact, wifi, **link naar de Booking-boeking**.
- **Zwembad & spa**: voorwaarden en openingstijden.
- Bekend uit openbare bronnen (te bevestigen): gasten hebben gratis toegang tot de wellness met
  panorama-binnenzwembad, alpensauna, infraroodcabine, rustruimte en ligweide; gratis wifi, parkeren, skiruimte.
- Alles wat niet bevestigd is: **[PLACEHOLDER]** (openingstijden spa/zwembad, check-in/out, Booking-link,
  wifi, borg, kosten, huisregels, contact). De eigenaar levert dit later aan.
- Admins kunnen de huisinfo in de app bewerken (eenvoudige tekstvelden/Markdown), zodat aanleveren later
  geen nieuwe release vereist.

### 4.5 Planning (met stemmen)
- Dag-tijdlijn per dag, **zo 28 feb t/m za 6 mrt**.
  - **Ma–vr** (skidagen): *vroeg skiën → lunch op de berg → après-ski → avondeten → slapen*.
  - **Zo** (aankomst) en **za** (vertrek): eenvoudige dagen zonder standaard stemmingen; admins kunnen ze wel toevoegen.
- **Locatiestemmingen** per skidag voor **lunch**, **après-ski** en **avondeten**:
  - Iedereen kan een plek voorstellen (uit de lijst, of nieuwe toevoegen met naam + optioneel kaartpunt/link).
  - Iedereen stemt; één stem per persoon per stemming, te wijzigen tot het besluit.
  - Een **admin** drukt op **"Besluit"** → plek staat vast in de planning met route + menukaart.
  - Admins kunnen opties verwijderen en een besluit terugdraaien.
- **Dagpolls** per skidag (je ziet wie wat koos):
  - Vroeg mee skiën of uitslapen?
  - Hoe laat lunch? (tijdsloten, bijv. 11:30 / 12:00 / 12:30 / 13:00 / 13:30)
  - Après-ski of spa/zwembad in het huis?
- **Meldingen**: push bij een besluit ("Lunch woensdag: X, 12:30") en 's avonds (≈20:00) een
  herinnering als je voor morgen nog niet gestemd hebt.
- Later uitbreidbaar (bijv. automatisch besluit op deadline) — niet nu bouwen.

## 5. Navigatie over pistes (moet betrouwbaar zijn)

- **Bron**: OpenStreetMap (pistes `piste:type=downhill`, liften `aerialway=*`, hutten/bars).
  Steekproef 2026-10-18 voor Bad Gastein/Hofgastein: 203 pistestukken (alle met moeilijkheid, 83% met nummer),
  48 benoemde liften. Sportgastein en Dorfgastein nog apart controleren.
- **Netwerk** vooraf (bij build) opgebouwd als graaf: pistesegmenten (bergaf, met kleur en nummer),
  liften (bergop), en verbindingen bij dal-/bergstations. Waar OSM verbindingen mist worden die
  automatisch gelegd (knooppunten binnen een kleine afstand) en daarna handmatig nagelopen.
- **Gecontroleerd tegen de officiële pistekaart** (nummers, kleuren, liftnamen).
- **Invoer**: start = "hier" (GPS), een lift (boven/onder), een restaurant, het huis of een persoon;
  doel = idem. Instelling **max. niveau: blauw / rood / zwart** (per gebruiker te onthouden).
- **Uitvoer**: stappen in gewone taal, bijv.
  "Neem piste 27 (blauw) → lift 22 → piste 5 (rood), restaurant ligt halverwege links", plus de route op de kaart.
- Dichte liften/pistes uit de live status worden vermeden; als er geen route is, zegt de app dat expliciet.
- **Offline**: graaf en routering draaien op de telefoon.
- **Handmatig bijsturen**: het netwerk staat in één leesbaar databestand in de repo. Daarnaast een
  admin-scherm om correcties op te slaan (verbinding toevoegen/blokkeren, nummer/kleur corrigeren,
  notitie zoals "hier stuk schaatsen"); correcties worden over het basisnetwerk heen gelegd.
- **Verificatie vóór de reis**: geautomatiseerde test dat huis → elke lift, elke lift → elk bekend
  restaurant/bar een route heeft; twijfelgevallen gemarkeerd en in een lijst voor de eigenaar.

## 6. Soipen-meter

- **Groepsstatus**: meter 0–100% met een modus, bijv. "Skimodus", "Lunchpauze-met-risico",
  "Après-ski modus", "Totale overgave", en een droge commentaarregel
  ("Skiambities dalen. De behoefte aan drank stijgt.").
- **Persoonlijke meter** ("Jij: 82% — Soipie maakt zich zorgen") en een **Soipen-ranking** van de groep.
- **Invoer die de score beïnvloedt**:
  - **Drankjes loggen**: grote knoppen — bier 0,3 L, bier 0,5 L, Jägermeister, wijn, shot, Glühwein;
    één tik per drankje, ongedaan te maken.
  - **Tijd in bars**: als je (bij open app) binnen een straal van een après-bar bent, telt de verblijftijd mee.
  - **Stemmen/polls**: meerderheid voor après → omhoog; vroeg skiën / spa → omlaag.
- Score zakt geleidelijk over tijd (kater-curve) en begint de ochtend lager, niet op 0 na een zware avond.
- De commentaarregel wordt door Soipie gegenereerd op basis van de echte cijfers, met variatie; als de AI
  niet bereikbaar is, een vaste set teksten per modus.
- Satirisch bedoeld; geen echte promillage-berekening en geen claims over rijvaardigheid.

## 7. Soipie (chatbot)

- Naam **Soipie**; Nederlands, toon droog en plagerig.
- Kent alle app-informatie: planning, stemmingen en besluiten, wie wat koos, huisinfo, restaurants/bars en
  menukaarten, lift-/pistestatus, weer, routes, Soipen-scores en laatst bekende locaties van de groep.
- Capaciteit: **50–100 chats per dag** voor de hele groep.
- Gratis cloud-API, niet op de PC van de eigenaar. Voorkeur: Google Gemini Flash (gratis tier);
  OpenRouter-gratis modellen als alternatief/terugval. API-sleutel alleen server-side.
- Eenvoudige limiet per gebruiker om de dagelijkse gratis quota niet op te maken.

## 8. Accounts en rollen

- Registratie via de gedeelde link met een **groepscode**, zodat vreemden geen account kunnen maken.
- Inloggen met e-mail + wachtwoord; blijvend ingelogd.
- Profiel: weergavenaam, kleur/avatar.
- Rollen: **admin** (eigenaar, Sjoerd) en **lid**. Admins: besluiten nemen/terugdraaien, opties verwijderen,
  huisinfo bewerken, navigatiecorrecties.

## 9. Gemaakte keuzes (call van de bouwer, door de eigenaar vrijgegeven: "alles bepalen zolang het gratis blijft")

- **Frontend**: React + TypeScript + Vite, als PWA (service worker, manifest, offline cache). UI in het Nederlands.
- **Hosting**: Cloudflare Pages of GitHub Pages (statisch, gratis, vaste deelbare URL).
- **Backend**: Supabase gratis tier — Auth, Postgres, Realtime (live stemmen/locaties), Edge Functions
  (Soipie, push, liftstatus ophalen).
  - Gratis projecten pauzeren na ~1 week inactiviteit → geplande "keep-alive" (bijv. GitHub Action elke paar dagen) tot en met de reis.
- **Kaart**: MapLibre met gratis OSM-gebaseerde tegels; piste/lift/POI-laag uit eigen OSM-extract.
- **Live liftstatus**: geen openbare API; de status van Skigastein (via Intermaps) wordt elke 10–15 min
  server-side opgehaald en omgezet. Breekbaar bij site-wijzigingen → altijd link naar officiële pagina en
  "laatst bijgewerkt"-tijd.
- **Weer**: Open-Meteo (gratis, geen sleutel).
- **Push**: Web Push (VAPID) vanuit Edge Functions.
- **Menukaarten**: in de app (tekst of PDF/afbeelding) waar online beschikbaar; anders een link.

## 10. Bekende plekken (startlijst, aan te vullen uit OSM)

Après/horeca uit openbare bronnen: Hirschen Hütt'n (Angertal), Weitmoserin (dalstation Schlossalmbahn),
Aeroplanstadl (Schlossalm), Salettl, Feuer.Bar, Gastein Alm, Silver Bullet, Haeggblom's Bar, Lederhosenbar.
Iedereen kan in de app nieuwe plekken toevoegen.

## 11. Aan de bouwer overgelaten

- Exacte UI-vormgeving, kleurenschema, iconen, app-naam/icoon (Nederlands, wintersport-sfeer).
- Datamodel, API-vorm, mappenstructuur, testaanpak.
- Exacte Soipen-formule (gewichten, verval), zolang het gedrag in §6 klopt.
- Hoe de OSM-graaf technisch wordt gebouwd en gerouteerd.
- Welke gratis AI-provider precies, binnen §7.

## 12. Kleine keuzes van de bouwer (eigenaar kan ze bij het lezen nog omgooien)

- **Skigebied-afbakening**: navigatie en kaart dekken het Gasteinertal — Stubnerkogel/Angertal/Schlossalm,
  Graukogel, Sportgastein en Dorfgastein. Niet de rest van Ski amadé.
- **Avondeten**: de stemming heeft standaard ook de optie **"Thuis koken"**.
- **Terugval liftstatus**: lukt het automatisch ophalen niet, dan toont de Berg-tab de officiële statuspagina
  (link/ingesloten) en werkt navigatie zonder live-status, met de melding "liftstatus onbekend".
- **Groepscode** wordt door de eigenaar gekozen en is in de app door een admin te wijzigen.
- **Soipen-ranking** is alleen binnen de groep zichtbaar.

## 13. Open punten (eigenaar levert later aan)

- Huisinfo (zie §4.4) — tot dan **[PLACEHOLDER]**.
- E-mailadressen/namen van deelnemers zijn niet nodig vooraf; iedereen registreert zichzelf met de groepscode.
