# Feature Specification: Mitglieder-Profilseite

**Feature Branch**: `002-member-profile`
**Created**: 2026-09-16
**Status**: Draft
**Input**: User description: "Jedes Mitglied sollte eine Profilseite haben, auf der es sein Avatar setzen und seinen Namen anpassen können sollte."

## Clarifications

### Session 2026-09-16

- Q: Sollen Trainer auch einen unangemessenen Anzeigenamen zurücksetzen
  können (nicht nur ein unangemessenes Avatar)? → A: Ja, analog zur
  Avatar-Moderation — Reset auf den aus der E-Mail abgeleiteten
  Standardnamen.
- Q: Darf ein Anzeigename leer gespeichert werden? → A: Nein, mindestens 2
  sichtbare Zeichen erforderlich; ein zu kurzer/leerer Versuch wird
  abgelehnt und der bisherige Name bleibt bestehen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mitglied passt seinen Anzeigenamen an (Priority: P1)

Ein eingeloggtes Mitglied (Trainer oder Spieler-Account) öffnet seine
Profilseite, sieht dort seinen aktuellen Anzeigenamen und kann ihn ändern.
Der neue Name erscheint überall dort, wo das Mitglied bisher schon mit Namen
sichtbar war (z. B. in der Mitgliederliste des Teams).

**Why this priority**: Der Anzeigename existiert bereits im System (aktuell
nur aus der E-Mail-Adresse abgeleitet) und ist überall sichtbar, wo Mitglieder
aufgeführt werden — ihn selbst pflegen zu können ist der unmittelbarste,
eigenständig wertvolle Teil dieser Anfrage.

**Independent Test**: Mitglied loggt sich ein, öffnet die Profilseite, ändert
den Namen und prüft, dass die Team-Mitgliederliste den neuen Namen zeigt.

**Acceptance Scenarios**:

1. **Given** ein eingeloggtes Mitglied ohne bisher selbst gewählten Namen,
   **When** es die Profilseite öffnet, **Then** sieht es seinen aktuellen
   (aus der E-Mail abgeleiteten) Anzeigenamen vorausgefüllt.
2. **Given** ein Mitglied auf seiner Profilseite, **When** es einen neuen
   Namen einträgt und speichert, **Then** wird der neue Name sofort
   übernommen und in der Team-Mitgliederliste angezeigt.
3. **Given** ein Mitglied, das in mehreren Teams Mitglied ist, **When** es
   seinen Namen ändert, **Then** gilt der neue Name in allen Teams, denen es
   angehört (ein Profil pro Konto, nicht pro Team).
4. **Given** ein Mitglied auf seiner Profilseite, **When** es den Namen
   leer lässt oder auf weniger als 2 sichtbare Zeichen kürzt und speichert,
   **Then** lehnt das System die Änderung ab und der bisherige Name bleibt
   unverändert bestehen.

---

### User Story 2 - Mitglied lädt ein Avatar-Bild hoch (Priority: P1)

Ein Mitglied lädt auf seiner Profilseite ein Bild als Avatar hoch. Das Bild
ersetzt einen eventuell vorhandenen früheren Avatar und wird künftig überall
dort gezeigt, wo das Mitglied bisher schon (z. B. mit Namen) sichtbar war.

**Why this priority**: Zusammen mit dem Namen ist das Avatar der zweite
Kern-Baustein der im Auftrag genannten Anfrage und macht Mitglieder in
Listen/Übersichten leichter erkennbar.

**Independent Test**: Mitglied lädt ein Bild hoch und sieht es unmittelbar
auf der eigenen Profilseite sowie in der Team-Mitgliederliste erscheinen.

**Acceptance Scenarios**:

1. **Given** ein Mitglied ohne Avatar, **When** es ein unterstütztes Bild
   hochlädt, **Then** wird dieses Bild ab sofort als sein Avatar angezeigt.
2. **Given** ein Mitglied mit vorhandenem Avatar, **When** es ein neues Bild
   hochlädt, **Then** ersetzt das neue Bild das alte vollständig (kein
   Verlauf mehrerer Avatare).
3. **Given** eine hochgeladene Datei in nicht unterstütztem Format oder über
   dem Größenlimit, **When** das Mitglied den Upload versucht, **Then** wird
   der Upload abgelehnt und eine verständliche Fehlermeldung angezeigt, ohne
   den bestehenden Avatar zu verändern.

---

### User Story 3 - Mitglied entfernt seinen Avatar (Priority: P2)

Ein Mitglied mit gesetztem Avatar entfernt diesen wieder und das System
zeigt stattdessen einen neutralen Platzhalter.

**Why this priority**: Ergänzt US2 um den Rückweg; ohne Rückweg fühlt sich
das Setzen riskanter an, ist aber für den Kernnutzen der Funktion nicht
zwingend erforderlich.

**Independent Test**: Mitglied mit gesetztem Avatar entfernt ihn über die
Profilseite und sieht sofort wieder den Platzhalter — an der eigenen
Profilseite und überall, wo es zuvor mit Avatar sichtbar war.

**Acceptance Scenarios**:

1. **Given** ein Mitglied mit gesetztem Avatar, **When** es den Avatar auf
   der Profilseite entfernt, **Then** zeigt das System ab sofort wieder den
   Standard-Platzhalter für dieses Mitglied.

---

### User Story 4 - Trainer setzt ein unangemessenes Avatar oder einen unangemessenen Namen zurück (Priority: P3)

Ein Trainer sieht, dass ein Mitglied seines Teams ein unangemessenes
Avatar-Bild oder einen unangemessenen/irreführenden Anzeigenamen gesetzt
hat, und setzt jeweils auf den Standardwert zurück (Avatar → Platzhalter,
Name → aus der E-Mail abgeleiteter Standardname).

**Why this priority**: Schutzmechanismus für den Missbrauchsfall, nicht Teil
des Kernnutzens (Selbstverwaltung von Name/Avatar in US1-US3), aber nötig,
damit die Funktion im Jugend-/Vereinskontext verantwortbar bleibt.

**Independent Test**: Trainer öffnet die Mitgliederverwaltung seines Teams,
setzt Avatar bzw. Namen eines Mitglieds zurück und prüft, dass jeweils der
Standardwert erscheint.

**Acceptance Scenarios**:

1. **Given** ein Mitglied seines Teams mit gesetztem Avatar, **When** ein
   Trainer dessen Avatar zurücksetzt, **Then** zeigt das System für dieses
   Mitglied ab sofort den Standard-Platzhalter anstelle des Bildes.
2. **Given** ein Mitglied seines Teams mit selbst gewähltem Anzeigenamen,
   **When** ein Trainer diesen Namen zurücksetzt, **Then** zeigt das System
   für dieses Mitglied ab sofort wieder den aus der E-Mail abgeleiteten
   Standardnamen.
3. **Given** ein Mitglied ohne gesetzten Avatar bzw. ohne selbst gewählten
   Namen, **When** ein Trainer die Mitgliederverwaltung öffnet, **Then**
   gibt es dafür keine Zurücksetzen-Aktion, da nichts zurückzusetzen ist.
4. **Given** ein Mitglied eines anderen Teams, mit dem der Trainer kein Team
   teilt, **When** der Trainer versucht, dessen Avatar oder Namen
   zurückzusetzen, **Then** lehnt das System dies ab.

---

### Edge Cases

- Was passiert, wenn sich die E-Mail-Adresse oder andere Kontodaten eines
  Mitglieds ändern (z. B. durch einen Adminvorgang)? Ein selbst gewählter
  Name/Avatar darf dadurch nicht stillschweigend zurückgesetzt werden.
- Ein Mitglied hat noch nie einen eigenen Namen/Avatar gesetzt: Es sieht
  weiterhin die bisherigen Standardwerte (aus E-Mail abgeleiteter Name, kein
  Avatar), bis es die Profilseite aktiv nutzt.
- Ein Mitglied verlässt das letzte Team oder das Konto wird gelöscht: Profil
  (Name, Avatar) wird mit dem Konto gelöscht, kein verwaistes Datenrest.
- Zwei sehr schnell aufeinanderfolgende Avatar-Uploads desselben Mitglieds:
  Nur das zuletzt erfolgreich hochgeladene Bild bleibt aktiv.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Jedes eingeloggte Mitglied MUSS eine eigene Profilseite
  aufrufen können, unabhängig davon, welches Team gerade aktiv ist (ein
  Profil pro Konto, nicht pro Team).
- **FR-002**: Ein Mitglied MUSS auf dieser Seite seinen eigenen Anzeigenamen
  einsehen und ändern können.
- **FR-002a**: Das System MUSS einen Anzeigenamen mit weniger als 2
  sichtbaren Zeichen (einschließlich leer) ablehnen und den bisherigen
  Namen unverändert beibehalten.
- **FR-003**: Ein Mitglied MUSS auf dieser Seite ein Bild als eigenen Avatar
  hochladen können.
- **FR-004**: Ein Mitglied MUSS einen gesetzten Avatar wieder entfernen
  können; das System zeigt danach einen neutralen Platzhalter.
- **FR-005**: Das System MUSS Avatar-Uploads auf gängige Bildformate und
  eine maximale Dateigröße beschränken und andere Uploads mit einer
  konkreten, verständlichen Fehlermeldung ablehnen.
- **FR-006**: Ein Mitglied DARF NICHT den Namen oder Avatar eines anderen
  Mitglieds über diese Seite einsehen oder verändern können.
- **FR-007**: Ein geänderter Name bzw. Avatar MUSS überall dort sichtbar
  werden, wo das Mitglied bereits zuvor für seine Teamkolleg:innen sichtbar
  war (z. B. Mitgliederliste), ohne dass Teamkolleg:innen etwas dafür tun
  müssen.
- **FR-008**: Das System DARF NICHT den Namen oder das Avatar eines
  Mitglieds außerhalb der Teams zeigen, denen dieses Mitglied angehört —
  insbesondere NICHT auf der anonymen öffentlichen Rangliste.
- **FR-009**: Das System MUSS einen selbst gewählten Namen/Avatar dauerhaft
  beibehalten; er DARF NICHT durch andere, unabhängige Kontoänderungen (z. B.
  E-Mail-Änderung) stillschweigend zurückgesetzt werden.
- **FR-010**: Trainer MÜSSEN in der Lage sein, den Avatar eines Mitglieds
  ihres Teams auf den Standard-Platzhalter zurückzusetzen, falls dieser
  unangemessen ist.
- **FR-010a**: Trainer MÜSSEN ebenso in der Lage sein, den Anzeigenamen
  eines Mitglieds ihres Teams auf den aus der E-Mail abgeleiteten
  Standardnamen zurückzusetzen, falls dieser unangemessen oder
  irreführend ist.
- **FR-011**: Das Feature MUSS gleichermaßen und ohne Einschränkung für
  Konten mit Trainer- und mit Spieler-Rolle gelten — keine zusätzliche
  Einwilligung erforderlich, um einen eigenen Foto-Avatar zu setzen.

### Key Entities

- **Mitgliederprofil**: Persönliche Identität eines Kontos — Anzeigename und
  Avatar-Bild. Genau eins pro Konto, unabhängig von der Anzahl der Teams,
  denen das Konto angehört. Sichtbar für alle Mitglieder, mit denen das
  Konto mindestens ein Team teilt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Mitglied kann seinen Anzeigenamen in unter 30 Sekunden
  ändern und sieht ihn danach sofort in der Team-Mitgliederliste.
- **SC-002**: Ein Mitglied kann ein Avatar-Bild hochladen und sieht es beim
  nächsten Aufruf jeder Seite, auf der es zuvor mit Namen sichtbar war, ohne
  zusätzliche Schritte.
- **SC-003**: 100 % der Uploads mit nicht unterstütztem Format oder über dem
  Größenlimit werden abgelehnt und mit einer konkreten Fehlermeldung
  quittiert, nie mit einem stillen Fehlschlag.
- **SC-003a**: 100 % der Versuche, einen Namen mit weniger als 2 sichtbaren
  Zeichen zu speichern, werden abgelehnt, ohne den bisherigen Namen zu
  verändern.
- **SC-004**: Ein entfernter Avatar wird zu 100 % durch den Standard-
  Platzhalter ersetzt, ohne dass alte Bilddaten weiter abrufbar bleiben.
- **SC-005**: Kein Name oder Avatar eines Mitglieds erscheint für Betrachter
  außerhalb der gemeinsamen Teams, insbesondere nicht auf der anonymen
  öffentlichen Rangliste.

## Assumptions

- Ein Mitglied ist ein Konto mit mindestens einer Team-Mitgliedschaft
  (Trainer- oder Spieler-Rolle) — nicht zu verwechseln mit einem
  Spielerstamm-Eintrag (`players`), der auch ohne verknüpftes Konto
  existieren kann und dieser Feature-Spezifikation nicht unterliegt.
- Die Sichtbarkeitsgrenze folgt dem bereits bestehenden Modell "sichtbar für
  alle, die mindestens ein Team teilen" (wie es für Mitgliederlisten bereits
  gilt) — keine zusätzliche öffentliche oder teamübergreifende Sichtbarkeit.
- Formatlimits für Avatar-Uploads orientieren sich an den bereits im System
  unterstützten Bildformaten für Trainingsfotos.
- Kein Freigabe-Workflow für Namensänderungen — ein Mitglied kann seinen
  eigenen Namen jederzeit ohne Bestätigung durch einen Trainer ändern.
