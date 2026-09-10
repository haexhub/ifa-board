# Feature Specification: Trainingspunkte & Trainingsfotos

**Feature Branch**: `001-points-and-photos`
**Created**: 2026-09-10
**Status**: Draft
**Input**: User description: "Für unsere Fußballmannschaft brauchen wir eine Web-App,
mit der Trainer pro Training Punkte an Spieler vergeben können, und Spieler ihre
eigene Entwicklung im Zeitverlauf sehen." (full brief captured in the feature
request)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trainer erfasst Punkte und Foto für ein Training (Priority: P1)

Ein Trainer kommt nach dem Training vom Platz, öffnet die App auf dem Handy,
legt das heutige Training an (Datum vorbelegt), sieht den aktiven Kader in
einer Liste, trägt pro Spieler in den aktiven Punktekategorien einen Wert ein,
lädt mindestens ein Foto vom Training hoch und speichert. Das Training taucht
danach in der Trainings-Historie auf und die vergebenen Punkte fließen in
Rangliste und Verlaufsauswertungen ein.

**Why this priority**: Das ist der Kern-Loop, der überhaupt Daten in das System
bringt. Ohne diesen Flow gibt es weder Rangliste noch Verlauf. Vor jedem
anderen Feature muss dieses funktionieren.

**Independent Test**: Nach initialem Seed (Kader + eine Kategorie
"Trainingsleistung" 0–5 + eine Trainer-Login) kann ein Trainer ohne weitere
Vorbereitung ein Training anlegen, für alle Kaderspieler Werte eintragen, ein
Foto hochladen, speichern und das gespeicherte Training in der Historie
öffnen. Damit ist die Kern-Wertschöpfung demonstrierbar.

**Acceptance Scenarios**:

1. **Given** der Trainer ist eingeloggt und mindestens ein Spieler ist im
   aktiven Kader und mindestens eine Punktekategorie ist aktiv, **When** der
   Trainer "Neues Training" wählt, das Datum bestätigt, für jeden Kaderspieler
   einen gültigen Punktwert einträgt und mindestens ein Foto hochlädt und
   speichert, **Then** wird das Training persistiert, alle Punkteinträge sind
   dem Training zugeordnet, das Foto ist in der Trainingsgalerie sichtbar,
   und das Training erscheint in der Trainings-Historie mit dem gewählten
   Datum.
2. **Given** ein Training ist bereits gespeichert, **When** der Trainer das
   Training erneut öffnet, einen Punktwert korrigiert und speichert, **Then**
   wird der neue Wert übernommen und der alte Wert überschrieben; ein
   Audit-Feld (last_updated_at, last_updated_by) wird aktualisiert.
3. **Given** der Trainer versucht ein Training zu speichern, ohne mindestens
   ein Foto hochgeladen zu haben, **When** er auf "Speichern" tippt, **Then**
   wird die Aktion blockiert und der Trainer sieht eine klare
   Fehlermeldung: "Mindestens ein Foto ist Pflicht".
4. **Given** ein Trainer trägt für einen Spieler einen Wert außerhalb des in
   der Kategorie definierten Wertebereichs ein, **When** er speichern will,
   **Then** wird der einzelne Feldwert als ungültig markiert und das Training
   nicht gespeichert.

---

### User Story 2 - Spieler sieht Rangliste und eigenen Zeitverlauf (Priority: P1)

Ein Spieler loggt sich auf dem Handy ein. Er landet auf einem Dashboard, das
seine aktuelle Rangposition im Team über den Standardzeitraum (Saison bzw.
letzte 4 Wochen — siehe Assumptions) und die Top-3 des Teams zeigt. Von dort
wechselt er zu "Meine Punkte" und sieht einen Zeitverlauf seiner Punkte pro
Training, aufgesplittet nach Kategorie, mit einer Vergleichslinie
Team-Durchschnitt und Team-Median.

**Why this priority**: Ohne einen konsumierenden Nutzer hat die Erfassung
keinen Wert. Dieser Story macht die Erfassung für die Spieler sichtbar und
liefert die versprochene Motivation ("Ansporn").

**Independent Test**: Mit Seed-Daten (mehrere Trainings, mehrere Spieler,
Werte in einer Kategorie) kann ein Spieler-Account einloggen, seine
Rangposition im Team lesen, seinen Zeitverlauf mit Vergleichslinien
Durchschnitt/Median in derselben Kategorie sehen — ohne dass ein Trainer
gleichzeitig aktiv sein muss.

**Acceptance Scenarios**:

1. **Given** der Spieler ist eingeloggt und im Zeitraum liegen ≥1 Trainings
   mit Punkten, **When** er das Dashboard öffnet, **Then** sieht er seine
   aktuelle Rangposition, seine Gesamtwertung im Zeitraum und die Top-3 des
   Teams.
2. **Given** der Spieler wechselt auf "Meine Punkte", **When** die Seite
   lädt, **Then** sieht er pro aktiver Kategorie einen Zeitverlauf seiner
   eigenen Werte pro Training und zwei Vergleichslinien: Team-Durchschnitt
   und Team-Median über denselben Zeitraum.
3. **Given** der Spieler wählt einen anderen Zeitraum ("Letzte 4 Wochen",
   "Saison", "Benutzerdefiniert"), **When** die Auswahl bestätigt wird,
   **Then** werden Rangliste und Zeitverlauf mit den Daten des neuen
   Zeitraums aktualisiert.

---

### User Story 3 - Trainer verwaltet Punktekategorien (Priority: P2)

Ein Trainer öffnet die Kategorienverwaltung, legt eine neue Kategorie
"Fairness" mit Wertebereich 0–5 an, setzt die Reihenfolge, und speichert. Ab
diesem Moment erscheint "Fairness" im Erfassungsformular jedes neuen
Trainings als zusätzliche Eingabespalte. Eine bestehende Kategorie kann er
deaktivieren; sie verschwindet aus dem Erfassungsformular, bleibt aber in
Historien-Trainings und Auswertungen sichtbar.

**Why this priority**: Nach P1 und P2 ist die App nutzbar, aber die
Kategorien sind noch Betreiber-abhängig. Kategorien-Selfservice ist ein
Constitution-Prinzip (III), aber erst nach dem MVP-Loop wertschöpfend, da
initial mit einer Kategorie gestartet werden kann.

**Independent Test**: Ein Trainer kann eine neue Kategorie anlegen und im
folgenden neuen Training eine Spalte dafür sehen und befüllen — ohne dass ein
Deploy oder eine Code-Änderung nötig ist.

**Acceptance Scenarios**:

1. **Given** der Trainer ist auf der Kategorienseite, **When** er "Neue
   Kategorie" wählt, Name "Fairness", Wertebereich 0–5, Reihenfolge 2 setzt
   und speichert, **Then** ist die Kategorie in der Liste sichtbar, aktiv,
   und beim Anlegen eines neuen Trainings erscheint sie als zweite Spalte.
2. **Given** eine Kategorie ist aktiv und hat historische Einträge, **When**
   der Trainer sie deaktiviert, **Then** verschwindet sie aus dem
   Erfassungsformular neuer Trainings, bleibt aber in Historien-Trainings
   und in Auswertungen für den historischen Zeitraum vollständig sichtbar.
3. **Given** eine Kategorie hat historische Einträge, **When** der Trainer
   versucht sie zu löschen, **Then** ist Löschen nicht möglich; nur
   Deaktivieren wird angeboten.

---

### User Story 4 - Trainer verwaltet Spielerstammdaten (Priority: P2)

Ein Trainer legt neue Spieler an (Name, optional Trikotnummer, Position),
markiert sie als aktiv/inaktiv im Kader, und korrigiert bestehende Angaben.
Ein einmal angelegter Spieler wird nie gelöscht — nur inaktiv gesetzt —, um
die Historie der Punkte zu bewahren.

**Why this priority**: Ohne Spieler kein Kader, aber der initiale Kader kann
im Seed angelegt werden. Selfservice ist nötig, sobald der Kader sich
saisonal ändert.

**Independent Test**: Ein Trainer kann einen neuen Spieler anlegen; dieser
erscheint sofort im Erfassungsformular für neue Trainings. Ein deaktivierter
Spieler erscheint nicht mehr in neuen Trainings, seine historischen Punkte
sind aber in Auswertungen sichtbar.

**Acceptance Scenarios**:

1. **Given** der Trainer ist auf der Spielerseite, **When** er "Neuer
   Spieler" wählt, Name eingibt und speichert, **Then** ist der Spieler im
   aktiven Kader sichtbar und in neuen Trainings erfassbar.
2. **Given** ein Spieler hat historische Punkteinträge, **When** der Trainer
   ihn deaktiviert, **Then** taucht der Spieler in neuen Trainings nicht
   mehr auf; seine historischen Werte bleiben in Rangliste und Zeitverlauf
   für vergangene Zeiträume sichtbar.

---

### User Story 5 - Anonyme Public-Rangliste ohne Login (Priority: P3)

Ein beliebiger Besucher öffnet eine öffentliche URL des Boards, ist NICHT
eingeloggt, und sieht die aktuelle Team-Rangliste. Statt Namen erscheinen
ausschließlich Trikotnummern. Es sind keine Fotos, keine Trainingsdetails,
keine Einzelverläufe abrufbar.

**Why this priority**: Erhöht die Reichweite (Eltern, Vereinsumfeld) ohne
Klartext-Personendaten preiszugeben und ohne einen Account zu benötigen.
Setzt aber P1/P2 voraus (Daten müssen existieren, Sortierlogik muss
implementiert sein).

**Independent Test**: Ein Browser ohne Session ruft die Public-URL auf und
sieht Rangposition + Trikotnummer + Aggregate; ein Versuch, ein Foto oder
einen personalisierten Zeitverlauf über dieselbe Route zu holen, schlägt
fehl.

**Acceptance Scenarios**:

1. **Given** es liegen Trainings mit Punkten im Standardzeitraum vor,
   **When** ein nicht eingeloggter Besucher die Public-URL öffnet, **Then**
   sieht er eine Tabelle mit Rangposition, Trikotnummer und aggregierten
   Score-Werten pro aktiver Kategorie; Klartextnamen erscheinen nicht.
2. **Given** ein Spieler hat keine `jersey_number` gesetzt, **When** der
   nicht eingeloggte Besucher die Public-URL öffnet, **Then** wird der
   Spieler mit "—" statt einer Nummer angezeigt, seine Rangposition zählt
   dennoch.
3. **Given** ein nicht eingeloggter Besucher versucht via Public-Pfad auf
   Fotos, Trainings-Detaildaten oder Einzelverläufe zuzugreifen, **When**
   die Anfrage die Datenzugriffsschicht erreicht, **Then** wird sie
   abgelehnt.

---

### User Story 6 - Trainingsfoto-Galerie für alle eingeloggten Nutzer (Priority: P3)

Alle eingeloggten Nutzer (Trainer und Spieler) sehen pro Training eine
Galerie mit den zu diesem Training hochgeladenen Fotos. Öffentlicher Zugriff
ist ausgeschlossen.

**Why this priority**: Das Motiv "kleine Ansporn/Erinnerungsfunktion" wird
durch Fotos verstärkt, aber Punkte sind das primäre Bewertungskriterium.

**Independent Test**: Ein Spieler-Account kann ein vergangenes Training
öffnen und die Fotos anzeigen. Ein nicht eingeloggter Zugriff auf die
Foto-URLs schlägt fehl.

**Acceptance Scenarios**:

1. **Given** ein Training hat 3 Fotos, **When** ein eingeloggter Spieler das
   Training öffnet, **Then** sieht er alle 3 Fotos in einer scrollbaren
   Galerie, optimiert für Handy-Anzeige.
2. **Given** ein nicht eingeloggter Nutzer versucht die direkte Foto-URL
   aufzurufen, **When** die Anfrage die Speicherschicht erreicht, **Then**
   wird der Zugriff abgelehnt (kein authentifizierter Zugang, keine
   Auslieferung).

---

### Edge Cases

- **Kein aktiver Kader**: Wenn kein Spieler aktiv ist, blockt "Neues Training"
  mit dem Hinweis, dass zuerst mindestens ein Spieler angelegt werden muss.
- **Keine aktive Kategorie**: Wenn keine Kategorie aktiv ist, blockt "Neues
  Training" mit dem Hinweis, dass zuerst mindestens eine Kategorie angelegt
  werden muss.
- **Spieler nicht anwesend**: Wenn der Trainer für einen Spieler keinen Wert
  einträgt, wird das als "nicht bewertet" gespeichert (kein Nullpunkt).
  Solche Trainings zählen für diesen Spieler nicht in Durchschnitt/Median.
- **Trainings-Datum in der Zukunft**: Der Trainer kann kein Training mit
  einem Datum in der Zukunft anlegen.
- **Zwei Trainings am selben Tag**: Erlaubt (Doppel-Training möglich); beide
  werden als separate Datensätze geführt.
- **Wertebereich einer Kategorie ändert sich**: Ändert ein Trainer den
  Wertebereich einer bestehenden Kategorie, gelten neue Grenzen nur für
  neue Einträge; historische Werte bleiben unverändert, auch wenn sie
  außerhalb des neuen Bereichs liegen.
- **Foto-Upload schlägt fehl** (Netz weg, zu groß, Format nicht
  unterstützt): Klare Fehlermeldung, Training bleibt im ungespeicherten
  Zustand; teilweise eingetragene Punkte gehen nicht verloren, solange die
  Seite offen bleibt.
- **Spieler wurde deaktiviert, ist aber in historischem Training bewertet**:
  Seine historischen Werte sind sichtbar und werden in Auswertungen für
  Zeiträume, in denen er aktiv war, gezählt.
- **Zwei Spieler mit derselben Trikotnummer**: Erlaubt (z. B. Wechsel im
  Kader); die anonyme Ansicht listet beide getrennt, jeweils mit
  derselben Nummer, sortiert nach Rangposition.
- **Kein Spieler hat Punkte im gewählten Zeitraum**: Rangliste zeigt eine
  leere Tabelle mit klarer Meldung ("Keine Punkte im gewählten Zeitraum").
- **Alle aktiven Kategorien führen zu Gleichstand zwischen zwei Spielern**:
  Beide erhalten dieselbe Rangposition, die nächste Rangposition zählt um
  die Anzahl der Gleichstandsplätze weiter (Standard-Sportranking, z. B.
  1, 2, 2, 4).

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & Rollen**

- **FR-001**: Das System MUSS zwei Rollen unterstützen: `trainer` und
  `player`. Jeder authentifizierte Nutzer hat genau eine Rolle.
- **FR-002**: Trainer MÜSSEN Schreib- und Leserechte auf Trainings, Spieler,
  Punktekategorien, Punkteinträge und Trainingsfotos haben.
- **FR-003**: Spieler MÜSSEN Leserechte auf: Rangliste des Teams, eigenes
  Detail-Punktprofil, aggregierte Team-Statistik (Durchschnitt, Median),
  Trainingsübersicht und Trainingsfotos haben.
- **FR-004**: Der initiale Trainer-Account wird direkt im Auth-System des
  Backend-Providers angelegt (Assumption A1). Weitere Trainer-Accounts
  MÜSSEN durch einen bestehenden Trainer über die App anlegbar sein.
- **FR-005**: Spieler-Accounts MÜSSEN durch einen Trainer über die App
  anlegbar oder per E-Mail einladbar sein.
- **FR-006**: Nicht authentifizierte Anfragen MÜSSEN abgelehnt werden für
  alle Daten, ausgenommen die anonyme öffentliche Rangliste (siehe FR-060
  ff.). Foto-Assets sind IMMER auf authentifizierte Nutzer beschränkt.

**Trainings**

- **FR-010**: Ein Trainer MUSS ein Training anlegen können mit Pflichtfeld
  `date` und optionalem `title`/`note`.
- **FR-011**: Das System MUSS `date` in der Vergangenheit oder auf heute
  beschränken (kein zukünftiges Trainingsdatum).
- **FR-012**: Ein Trainer MUSS bei einem Training pro aktivem Kaderspieler
  und pro aktiver Kategorie einen Punktwert eintragen können, oder das Feld
  leer lassen (Interpretation: nicht bewertet).
- **FR-013**: Das System MUSS beim Speichern verhindern, dass ein Training
  ohne mindestens ein zugeordnetes Foto gespeichert wird.
- **FR-014**: Ein Trainer MUSS ein gespeichertes Training nachträglich
  editieren können (Punkte korrigieren, Fotos ergänzen, Fotos löschen).
- **FR-015**: Das System MUSS pro Punkteintrag `last_updated_at` und
  `last_updated_by` mitführen.

**Kategorien**

- **FR-020**: Punktekategorien MÜSSEN als Daten in der Datenbank liegen und
  von Trainern über die App verwaltbar sein.
- **FR-021**: Eine Kategorie MUSS mindestens Attribute `name`, `active` (bool),
  `sort_order` (int), `value_min` (int), `value_max` (int) haben.
- **FR-022**: Beim Punkteeintrag MUSS das System sicherstellen, dass Werte
  im Bereich [`value_min`, `value_max`] der Kategorie zum Erfassungs-
  zeitpunkt liegen.
- **FR-023**: Deaktivierte Kategorien MÜSSEN in Historien-Trainings und in
  Auswertungen sichtbar bleiben, aber im Erfassungsformular neuer Trainings
  NICHT mehr erscheinen.
- **FR-024**: Kategorien mit mindestens einem historischen Eintrag DÜRFEN
  NICHT löschbar sein. Deaktivieren muss angeboten werden.
- **FR-025**: Beim Systemstart MUSS mindestens eine Kategorie
  "Trainingsleistung" (Wertebereich 0–5, aktiv) vorhanden sein (Seed).

**Spielerstammdaten**

- **FR-030**: Spieler MÜSSEN mindestens `name` (Pflicht), `active` (bool),
  `jersey_number` (optional), `position` (optional) haben.
- **FR-031**: Trainer MÜSSEN Spieler anlegen, editieren und aktiv/inaktiv
  setzen können.
- **FR-032**: Spieler mit historischen Punkteinträgen DÜRFEN NICHT gelöscht
  werden. Deaktivieren muss angeboten werden.
- **FR-033**: Nur aktive Spieler MÜSSEN im Erfassungsformular neuer
  Trainings erscheinen; inaktive Spieler bleiben in Historie sichtbar.

**Fotos**

- **FR-040**: Fotos MÜSSEN einem konkreten Training zugeordnet gespeichert
  werden.
- **FR-041**: Fotos MÜSSEN nur für authentifizierte Nutzer (Trainer und
  Spieler) abrufbar sein. Öffentlicher URL-Zugriff MUSS abgelehnt werden.
- **FR-042**: Das System MUSS Fotos ≤10 MB pro Datei akzeptieren
  (Assumption A2); größere Dateien werden mit klarer Fehlermeldung
  abgelehnt.
- **FR-043**: Unterstützte Formate: JPEG, PNG, HEIC/HEIF, WebP (Assumption
  A3).

**Auswertungen**

- **FR-050**: Das System MUSS eine Team-Rangliste über einen wählbaren
  Zeitraum anzeigen. Zeitraum-Optionen: "Letzte 4 Wochen", "Saison",
  "Benutzerdefiniert (von–bis)". Standard: "Saison" (Assumption A4).
- **FR-051**: Die Rangposition MUSS lexikographisch nach der Reihenfolge der
  Kategorien (aufsteigend nach `sort_order`) berechnet werden. Innerhalb
  jeder Kategorie wird nach `SUM(value)` über den gewählten Zeitraum
  absteigend sortiert. Die Kategorie mit der niedrigsten `sort_order` ist
  die primäre Sortierung; die nächste Kategorie bricht Gleichstand; und so
  weiter. Deaktivierte Kategorien werden für neue Rangliste-Berechnungen
  ignoriert, bleiben aber in Zeitverlauf-Auswertungen sichtbar.
  Bleibt nach allen aktiven Kategorien immer noch Gleichstand, gilt die
  gleiche Rangposition für die betroffenen Spieler.
- **FR-052**: Für jeden Spieler MUSS ein Zeitverlauf pro Kategorie
  darstellbar sein (Punktwert vs. Trainingsdatum), inklusive
  Vergleichslinien Team-Durchschnitt und Team-Median über denselben
  Zeitraum.
- **FR-053**: Auswertungen MÜSSEN Spieler ausklammern, die zum Trainings-
  zeitpunkt nicht bewertet wurden (leere Einträge zählen nicht als 0).
- **FR-054**: Trainer MÜSSEN alle Auswertungen für alle Spieler sehen.
  Spieler MÜSSEN vollen Zugriff auf die Detail-Auswertungen ALLER Spieler
  des Teams haben (voll transparent): Zeitverlauf pro Kategorie pro Spieler,
  Rangliste mit Namen, aggregierte Statistik. Die Team-Kultur ist
  transparent-vergleichend; individuelle Bewertungen sind bewusst offen im
  Team.

**Anonyme öffentliche Rangliste**

- **FR-060**: Das System MUSS eine anonyme öffentliche Rangliste bereitstellen,
  die OHNE Login abrufbar ist.
- **FR-061**: In der anonymen Ansicht werden Spieler ausschließlich über ihre
  `jersey_number` identifiziert. Klartext-Namen, `position`,
  `linked_user_id` und alle sonstigen personenidentifizierenden Attribute
  DÜRFEN NICHT übertragen oder angezeigt werden.
- **FR-062**: Die anonyme Ansicht MUSS ausschließlich anzeigen:
  Rangposition, `jersey_number`, aggregierte Score-Werte pro aktiver
  Kategorie im Zeitraum. Alle anderen Daten (Trainings-Historie,
  Foto-Galerien, Einzelwerte pro Training, Detail-Zeitverläufe, Spieler-
  stammdaten) DÜRFEN in der anonymen Ansicht NICHT abrufbar sein.
- **FR-063**: Spieler ohne `jersey_number` MÜSSEN in der anonymen Ansicht
  als "—" (kein Identifier) angezeigt werden; ihre Rangposition zählt
  trotzdem.
- **FR-064**: Der öffentliche Zugriff MUSS über eine dedizierte Route bzw.
  einen dedizierten Datenzugriffspfad (View/RPC mit Public-Policy) laufen,
  der ausschließlich das Datenschema aus FR-062 preisgibt.

**Nicht-Ziele (v1)**

- **NG-001**: Mehr-Teams-Fähigkeit ist ausgeschlossen; das System betreibt
  genau eine Mannschaft.
- **NG-002**: Push-Notifications, In-App-Chat und Kommentare auf Trainings
  sind ausgeschlossen.
- **NG-003**: Trainingsplanung/Kalender ist ausgeschlossen.
- **NG-004**: Öffentliches Sharing individueller Klartextnamen, Fotos oder
  Detaildaten ist ausgeschlossen. (Öffentlich sichtbar ist ausschließlich
  die anonyme Rangliste nach FR-060 ff.)
- **NG-005**: Video-Upload ist ausgeschlossen.
- **NG-006**: Erfassung/Statistik zu Ligaspielen ist ausgeschlossen.

### Key Entities

- **Player**: Ein Kadermitglied. Attribute: `name` (Pflicht), `active`,
  `jersey_number` (optional), `position` (optional), `linked_user_id`
  (optional, verweist auf einen Player-Login, sofern der Spieler einen
  Account hat).
- **PointCategory**: Ein Bewertungskriterium. Attribute: `name`, `active`,
  `sort_order`, `value_min`, `value_max`.
- **Training**: Eine Trainingseinheit. Attribute: `date` (Pflicht),
  `title` (optional), `note` (optional), `created_by` (Trainer),
  `created_at`, `last_updated_at`, `last_updated_by`.
- **PointEntry**: Ein Punktwert eines Spielers in einer Kategorie für ein
  Training. Attribute: `training_id`, `player_id`, `category_id`, `value`,
  `last_updated_at`, `last_updated_by`. Fehlender Eintrag bedeutet "nicht
  bewertet".
- **TrainingPhoto**: Ein Foto zu einem Training. Attribute: `training_id`,
  `storage_path`, `content_type`, `size_bytes`, `uploaded_by`,
  `uploaded_at`. Mindestens 1 pro Training.
- **UserAccount**: Ein Auth-Konto mit Rolle `trainer` oder `player`; für
  Spieler-Konten kann eine Verknüpfung zu genau einem Player bestehen.
- **AuditFields** (nicht eigene Entity, aber Konvention): `created_at`,
  `created_by`, `last_updated_at`, `last_updated_by` auf jeder mutierbaren
  Entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Trainer erfasst in ≤2 Minuten auf dem Handy für 15
  Spieler in zwei Kategorien alle Punkte plus ein Foto und speichert
  erfolgreich.
- **SC-002**: Ein Spieler öffnet die App auf dem Handy und sieht in ≤5
  Sekunden nach dem Login seine Rangposition und den Einstieg in seinen
  Punkte-Zeitverlauf.
- **SC-003**: 100 % der Datenzugriffe respektieren die Rollen: ein
  Spieler-Konto erhält bei einem direkten API-Zugriff auf ein
  Trainer-only-Endpoint bzw. auf Detaildaten außerhalb seines Scopes eine
  Ablehnung (verifiziert durch mindestens einen negativen Testfall pro
  Rolle-Ressource-Kombination).
- **SC-004**: 100 % der Trainings enthalten ≥1 Foto (Speichern ohne Foto
  ist strukturell ausgeschlossen).
- **SC-005**: Punkteintragswerte außerhalb des zum Erfassungszeitpunkt
  definierten Wertebereichs einer Kategorie werden in 100 % der Fälle
  abgelehnt.
- **SC-006**: Eine neue Punktekategorie kann von einem Trainer in ≤60
  Sekunden angelegt werden und ist im nächsten neuen Training als Eingabe-
  spalte verfügbar, ohne Code-Änderung oder Deploy.
- **SC-007**: Historische Auswertungen für einen deaktivierten Spieler
  bleiben sichtbar und unverändert nach seiner Deaktivierung.
- **SC-008**: 100 % der Anfragen an den öffentlichen Rangliste-Pfad ohne
  Session liefern ausschließlich das in FR-062 definierte Datenschema;
  jeder Versuch, personenidentifizierende Attribute (Namen, Fotos,
  Detail-Zeitverläufe) über diesen Pfad zu beziehen, wird abgelehnt
  (verifiziert durch mindestens einen negativen Testfall pro geschützter
  Ressource).

## Assumptions

- **A1**: Initialer Trainer-Login wird direkt im Auth-System des Backend-
  Providers angelegt (nicht über die App). Weitere Trainer werden per
  App-Oberfläche angelegt. Rationale: einfachster Start-Zustand, kein
  Bootstrapping-Problem.
- **A2**: Einzel-Foto-Limit 10 MB. Rationale: bequemer Upload vom Handy
  ohne aufwändige Client-Kompression; genug für Handy-Aufnahmen.
- **A3**: Zulässige Foto-Formate: JPEG, PNG, HEIC/HEIF, WebP. Rationale:
  Abdeckung iPhone (HEIC) + Android (JPEG/WebP) + Legacy (PNG).
- **A4**: Standardzeitraum für Rangliste und Auswertungen ist "Saison"
  (Saison-Startdatum konfigurierbar durch Trainer; Fallback: Jahresbeginn
  des aktuellen Jahres, falls nichts gesetzt). Rationale: bezugsstärkster
  Zeitraum für Nutzer im Vereinsalltag.
- **A5**: Anwesenheit wird nicht als eigenes Feld erfasst. Ein leerer
  Punktwert bedeutet "nicht bewertet" (typischerweise: nicht anwesend
  oder nicht bewertbar) und zählt nicht in Statistiken. Rationale:
  einfachstes Datenmodell; explizite Anwesenheit wäre YAGNI.
- **A6**: v1 hat kein "zweiter Spieler vergleichen"-Feature; wird in einem
  späteren Feature-Cycle erwogen.
- **A7**: Alle Fotos werden dauerhaft aufbewahrt; kein Auto-Cleanup in v1.
- **A8**: Die App wird als Web-App bereitgestellt (kein nativer App-Store-
  Release), ist aber Mobile-First und "Add to Home Screen"-tauglich.
- **A9**: Innerhalb einer Kategorie wird nach `SUM(value)` im gewählten
  Zeitraum sortiert (nicht Durchschnitt). Rationale: einfachste
  Interpretation von "Punkte"; belohnt Anwesenheit + Leistung.
  Durchschnitts- oder gewichtete Varianten sind explizit YAGNI für v1.
- **A10**: Die Team-Kultur akzeptiert vollständige innerbetriebliche
  Transparenz: jeder Spieler sieht die Detail-Bewertungen jedes anderen
  Spielers. Trainer sind sich bewusst, dass individuelle Bewertungen
  team-öffentlich sind. Dies ist eine bewusste Design-Entscheidung, keine
  Beschränkung des Datenmodells.
- **A11**: Die öffentliche Rangliste ist über eine feste, nicht geratene
  URL erreichbar (keine Signatur, keine Zeitbegrenzung); die Anonymität
  wird über das übertragene Datenschema (nur Trikotnummer, keine Namen)
  hergestellt, nicht über Zugriffsgeheimhaltung.
