# Feature Specification: Veo-Kamera-Analytics

**Feature Branch**: `003-veo-analytics`
**Created**: 2026-09-18
**Status**: Draft
**Input**: User description: "Ich möchte gerne als nächstes Feature die Analytics unserer Veo-Kamera mit anzeigen. Es gibt keine offizielle, selbst nutzbare API dafür (die dokumentierte Partner-API ist invite-only). Team-Stats pro Spiel und aggregiert über die Saison sollen automatisch aus dem Veo-Account des Vereins übernommen werden, ohne manuelle Eingabe."

## Clarifications

### Session 2026-09-18

- Q: Falls der Verein mehrere Teams im Playerboard hat: wie sollen Veo-Teams den Playerboard-Teams zugeordnet werden? → A: Nur ein Team fürs Erste — Feature startet mit genau einem festen Team-Mapping, weitere Teams sind ein späterer, separater Schritt.
- Q: Sollen beim ersten Sync auch die bereits vorhandenen, älteren Spiele aus Veo importiert werden, oder nur neue Spiele ab jetzt? → A: Komplette Historie importieren — beim ersten Sync werden alle bisherigen Spiele/Statistiken übernommen, danach laufend neue.
- Q: Wie zeitnah müssen neue Match-Stats nach einem Spiel in Playerboard sichtbar sein? → A: Täglicher Batch reicht — einmal pro Nacht synchronisieren ist ausreichend.
- Q: Wer soll den Sync-Status (letzter erfolgreicher Sync / Fehler-Hinweis) aus User Story 3 sehen können? → A: Alle Team-Mitglieder (Trainer und Spieler), nicht nur Trainer/Admin — der Status selbst ist keine sensible Information.
- Q: Was passiert mit bereits übernommenen Spieldaten, wenn das zugehörige Spiel in Veo nachträglich gelöscht oder auf privat gestellt wird? → A: Sie bleiben dauerhaft sichtbar; es gibt keinen aktiven Abgleich/Löschmechanismus gegen den Veo-Bestand.
- Q: Wie wird festgelegt, welches Playerboard-Team Veo-Daten sehen darf, und wer darf das ändern? → A: Die Freischaltung ist eine Platform-Admin-Entscheidung und wird in v1 über einen geschützten direkten Datenbankeintrag des Deployment-Operators umgesetzt; die Einstellungs-Oberfläche folgt im separaten Feature "Platform-Administration". Sie wird nicht automatisch aus einer festen Konfiguration abgeleitet — kein Team hat ohne diese Freischaltung Zugriff.
- Q: Soll die Platform-Admin-Rolle (inkl. Ernennen/Entfernen weiterer Admins) Teil dieser Spec sein? → A: Nein — eigenes, vorgelagertes Feature ("Platform-Administration"); diese Spec setzt darauf auf und liefert nur die Veo-spezifische Team-Zuordnung innerhalb dieser Verwaltung.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Team-Statistiken eines Spiels ansehen (Priority: P1)

Ein Mitglied (Trainer oder Spieler-Account) öffnet die Seite eines Spiels, das
mit der Veo-Kamera aufgezeichnet und bereits von Veo ausgewertet wurde, und
sieht dort automatisch die Team-Statistiken dieses Spiels — Ergebnis, Tore,
Schüsse, Ecken, Freistöße, Fouls, Tacklings, Dribblings, Interceptions und
Paraden, jeweils für das eigene und das gegnerische Team, mit Aufschlüsselung
nach Halbzeit. Niemand muss diese Werte händisch eintragen.

**Why this priority**: Das ist der eigentliche Kern der Anfrage — Daten, die
heute nur in der separaten Veo-App einsehbar sind, direkt in Playerboard
sichtbar zu machen, ohne dass jemand sie abtippt.

**Independent Test**: Für ein Team mit mindestens einem von Veo bereits
ausgewerteten Spiel erscheinen nach dem nächsten automatischen Sync-Lauf
Ergebnis und alle Statistik-Kategorien für dieses Spiel auf der
entsprechenden Seite in Playerboard.

**Acceptance Scenarios**:

1. **Given** ein Spiel wurde mit der Veo-Kamera aufgezeichnet und die
   Veo-Auswertung ist abgeschlossen, **When** der nächste automatische
   Sync-Lauf läuft, **Then** erscheinen Ergebnis und alle Statistik-Kategorien
   dieses Spiels (eigenes Team vs. Gegner, je Halbzeit) in Playerboard.
2. **Given** ein Spiel ist in Veo aufgezeichnet, aber die Auswertung dort noch
   nicht abgeschlossen, **When** der Sync-Lauf läuft, **Then** wird dieses
   Spiel ohne Statistik-Daten übersprungen (kein Fehlerzustand, kein Absturz)
   und beim nächsten Lauf erneut geprüft.
3. **Given** ein Spiel wurde bereits einmal synchronisiert, **When** der
   Sync-Lauf erneut läuft, **Then** entstehen keine doppelten Einträge für
   dasselbe Spiel.

---

### User Story 2 - Saison-Übersicht der Team-Statistiken ansehen (Priority: P2)

Ein Mitglied öffnet eine Team-Übersichtsseite und sieht dort die über alle
synchronisierten Spiele der Saison aggregierten Werte — u. a. Sieg-Niederlage-
Unentschieden-Bilanz und Summen der Statistik-Kategorien aus User Story 1.

**Why this priority**: Der ursprüngliche Wunsch war explizit eine
Team-Stats-Übersicht wie im Veo Analytics Studio, nicht nur Einzelspiel-Daten
— setzt aber User Story 1 als Datengrundlage voraus.

**Independent Test**: Nach dem Sync mehrerer Spiele eines Teams zeigt die
Team-Übersichtsseite plausible Summen/Bilanzen über genau diese Spiele.

**Acceptance Scenarios**:

1. **Given** mehrere Spiele eines Teams wurden synchronisiert, **When** die
   Team-Übersichtsseite geöffnet wird, **Then** zeigt sie Sieg/Unentschieden/
   Niederlage-Bilanz und Summen je Statistik-Kategorie über genau diese
   Spiele.
2. **Given** ein neues Spiel wird synchronisiert, **When** die
   Team-Übersichtsseite erneut geöffnet wird, **Then** sind die aggregierten
   Werte um dieses Spiel aktualisiert.

---

### User Story 3 - Sync-Status ist für alle Mitglieder nachvollziehbar (Priority: P3)

Ein Mitglied (Trainer oder Spieler-Account) sieht, wann die Veo-Daten zuletzt
erfolgreich aktualisiert wurden, und erhält einen sichtbaren Hinweis, wenn
die automatische Aktualisierung fehlschlägt oder seit längerem nicht mehr
gelaufen ist. Der Status ist für alle Team-Mitglieder sichtbar, nicht nur für
Trainer — er enthält keine sensiblen Informationen.

**Why this priority**: Der Sync hängt an einem Zugang, der jederzeit ungültig
werden kann (z. B. wenn die Vereins-Session bei Veo abläuft). Ohne
Sichtbarkeit merkt niemand, dass die angezeigten Daten seit Wochen veraltet
sind.

**Independent Test**: Wird ein fehlgeschlagener Sync-Lauf simuliert, zeigt die
App jedem Team-Mitglied einen sichtbaren Hinweis auf den fehlgeschlagenen
bzw. veralteten Sync, ohne falsche oder widersprüchliche Daten anzuzeigen.

**Acceptance Scenarios**:

1. **Given** der letzte Sync-Lauf war erfolgreich, **When** ein Mitglied die
   entsprechende Ansicht öffnet, **Then** sieht es den Zeitpunkt des letzten
   erfolgreichen Syncs.
2. **Given** mehrere Sync-Läufe in Folge sind fehlgeschlagen, **When** ein
   Mitglied die entsprechende Ansicht öffnet, **Then** sieht es einen klaren
   Hinweis, dass die Aktualisierung nicht mehr funktioniert.

---

### User Story 4 - Veo-Zugriff wird explizit für ein Team freigeschaltet (Priority: P1)

In v1 setzt der Deployment-Operator die Freischaltungsentscheidung des
Platform-Admins über einen geschützten direkten Datenbankeintrag um und
hinterlegt dort das zugehörige Veo-Club-/Team-Kürzel. Die Einstellungs-
Oberfläche gehört zum separaten Feature "Platform-Administration". Ohne diese
explizite Freischaltung sieht kein Team Veo-Daten — auch nicht versehentlich
durch eine falsche oder fehlende Konfiguration.

**Why this priority**: User Story 1-3 dürfen aus Sicherheitsgründen nicht
ohne diese Freischaltung ausgeliefert werden — ein Team darf niemals
automatisch Zugriff auf Veo-Daten bekommen. Die spätere Platform-Admin-
Oberfläche baut auf dem vorgelagerten Feature "Platform-Administration" auf;
bis dahin ist die manuelle, dokumentierte Ops-Aktion der einzige v1-Weg.

**Independent Test**: Der Deployment-Operator legt die dokumentierte
`veo_team_mappings`-Zeile für ein Team mit Club-/Team-Kürzel an; nur dieses
Team hat danach Zugriff. Ein Team ohne aktivierte Zeile sieht weiterhin
nichts.

**Acceptance Scenarios**:

1. **Given** der Platform-Admin hat die Freischaltung entschieden, **When** der
   Deployment-Operator die Mapping-Zeile mit `enabled = true` und dem
   Club-/Team-Kürzel direkt in der Datenbank anlegt, **Then** kann dieses Team
   ab dem nächsten Sync-Lauf Veo-Daten sehen.
2. **Given** für ein Team wurde keine Mapping-Zeile aktiviert, **When** ein Mitglied
   dieses Teams die Analytics-Seite öffnet, **Then** sieht es keine
   Veo-Daten.
3. **Given** der Deployment-Operator setzt `enabled = false` oder löscht die
   Mapping-Zeile, **When** ein Mitglied die Analytics-Seite öffnet, **Then**
   sieht es weder neue noch bereits gespeicherte Veo-Daten; die Daten bleiben
   für eine spätere Reaktivierung gespeichert.

---

### Edge Cases

- Ein Spiel, das bereits synchronisiert wurde, wird in Veo nachträglich
  gelöscht oder auf privat gestellt: Playerboard zeigt die zuletzt
  synchronisierten Daten dauerhaft weiter an; es gibt keinen aktiven
  Abgleich, der Spiele wieder entfernt, die in Veo verschwunden sind.
- Ein Team wurde nicht für Veo freigeschaltet (keine aktivierte Zeile in der
  Team-Zuordnung): Playerboard zeigt für dieses Team keine Veo-Daten und
  keinen Sync-Status an, nicht die Daten eines anderen Teams. Wird eine
  bestehende Zuordnung deaktiviert, bleiben die Daten gespeichert, sind aber
  bis zur Reaktivierung nicht lesbar.
- Der Veo-Zugang des Vereins läuft ab (z. B. Session ungültig): Sync-Läufe
  schlagen fehl, bestehende Daten bleiben unverändert sichtbar, der Hinweis
  aus User Story 3 macht den Zustand sichtbar; ein Mensch muss den Zugang
  manuell erneuern.
- Ein Spiel hat in Veo keine oder nur unvollständige Statistik-Kategorien
  (z. B. weil die KI-Auswertung bestimmte Ereignisse nicht erkannt hat):
  Playerboard zeigt genau die Kategorien, die Veo liefert, keine
  erfundenen/geschätzten Werte für fehlende Kategorien.
- Zwei Sync-Läufe überlappen sich zeitlich: Es darf nicht zu doppelten oder
  widersprüchlichen Einträgen für dasselbe Spiel kommen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatisch Ergebnis und Team-Statistiken für
  Spiele aus dem Veo-Account des Vereins übernehmen, sobald deren
  Veo-Auswertung abgeschlossen ist — ohne manuelle Dateneingabe durch
  Trainer oder Spieler.
- **FR-002**: System MUST pro Spiel mindestens folgende Statistik-Kategorien
  anzeigen, jeweils für eigenes Team und Gegner getrennt: Tore, Schüsse,
  Ecken, Freistöße, Fouls, Tacklings, Dribblings, Interceptions, Paraden.
- **FR-003**: System MUST diese Statistiken zusätzlich pro Halbzeit
  aufschlüsseln, sofern Veo diese Aufschlüsselung liefert.
- **FR-004**: System MUST die synchronisierten Einzelspiel-Statistiken zu
  einer Saison-Übersicht pro Team aggregieren (u. a. Sieg/Unentschieden/
  Niederlage-Bilanz, Summen je Kategorie).
- **FR-005**: System MUST beim ersten Sync die komplette bisher in Veo
  vorhandene Spielhistorie des zugeordneten Teams importieren, nicht nur
  neue Spiele ab Aktivierung.
- **FR-006**: System MUST neue oder aktualisierte Spiele mindestens einmal
  täglich automatisch synchronisieren, ohne dass ein Mensch den Sync manuell
  anstoßen muss.
- **FR-007**: System MUST ein Spiel, dessen Veo-Auswertung noch nicht
  abgeschlossen ist, beim Sync überspringen und beim nächsten Lauf erneut
  prüfen, statt einen Fehler auszulösen.
- **FR-008**: System MUST verhindern, dass ein bereits synchronisiertes Spiel
  bei erneutem oder überlappendem Sync doppelt oder widersprüchlich
  gespeichert wird.
- **FR-009**: System MUST für alle Team-Mitglieder (Trainer und Spieler)
  sichtbar machen, wann der letzte erfolgreiche Sync stattgefunden hat, und
  MUST erkennbar machen, wenn mehrere Sync-Läufe in Folge fehlgeschlagen
  sind.
- **FR-010**: System MUST den Zugang zum Veo-Account des Vereins so
  speichern, dass er ausschließlich dem automatischen Sync zur Verfügung
  steht — niemals für normale Mitglieder oder Spieler-Accounts einsehbar oder
  nutzbar.
- **FR-011**: In v1 MUST die Zuordnung eines Veo-Club-/Team-Kürzels zu einem
  Playerboard-Team als explizite, dokumentierte direkte SQL-Aktion des
  Deployment-Operators angelegt, geändert oder deaktiviert werden — nicht fest
  im Code oder Deployment verdrahtet. Diese Aktion setzt die Entscheidung des
  Platform-Admins um; die dafür vorgesehene Einstellungs-Oberfläche gehört zum
  separaten Feature "Platform-Administration". Ein Team MUST erst nach einer
  aktivierten Zuordnung Veo-Daten synchronisieren oder anzeigen können; ohne
  aktivierte Zuordnung darf ein Team keinerlei Veo-Daten sehen.
- **FR-012**: Spieler-individuelle Statistiken (pro Person statt pro Team)
  sind expliziter Nicht-Teil dieses Features.
- **FR-013**: Dieses Feature MUST keine eigene Administratoren-Verwaltung
  bauen. Sobald das vorgelagerte Feature "Platform-Administration" seine
  Platform-Admin-Rolle und Einstellungs-Oberfläche bereitstellt, MUST nur diese
  Rolle die Veo-Team-Zuordnung aus FR-011 ändern dürfen; bis dahin erfolgt die
  Änderung ausschließlich über den dokumentierten Deployment-Operator-
  Prozess.

### Key Entities

- **Team-Zuordnung**: Verknüpft ein Playerboard-Team mit dem entsprechenden
  Team im Veo-Account des Vereins (Club-/Team-Kürzel); in v1 über eine
  dokumentierte direkte SQL-Aktion des Deployment-Operators angelegt,
  geändert oder deaktiviert. Grundlage dafür, ob und welche Spiele für ein
  Team synchronisiert und gelesen werden — ohne aktivierte Zuordnung kein
  Zugriff.
- **Platform-Admin**: Eine teamübergreifende Berechtigung, definiert im
  vorgelagerten Feature "Platform-Administration"; hier nur als
  Voraussetzung referenziert, um die Team-Zuordnung zu verwalten.
- **Spiel (Match)**: Ein einzelnes, von Veo aufgezeichnetes und ausgewertetes
  Spiel mit Ergebnis, Datum/Gegner und den zugehörigen Statistik-Kategorien
  für eigenes Team und Gegner.
- **Statistik-Kategorie**: Ein einzelner Wert (z. B. "Ecken") für ein Spiel,
  eine Halbzeit und eine Mannschaftszuordnung (eigenes Team/Gegner).
- **Sync-Status**: Zeitpunkt und Ergebnis (erfolgreich/fehlgeschlagen) des
  letzten und der jüngsten automatischen Aktualisierungsläufe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Für jedes Spiel, dessen Veo-Auswertung abgeschlossen ist,
  erscheinen Ergebnis und alle verfügbaren Statistik-Kategorien spätestens
  24 Stunden später in Playerboard, ohne dass jemand Daten eintippt.
- **SC-002**: Eine Team-Übersichtsseite zeigt zu jedem Zeitpunkt eine
  Saison-Bilanz, die exakt der Summe der bis dahin synchronisierten Spiele
  entspricht (0 Abweichungen bei stichprobenhafter Nachrechnung).
- **SC-003**: Bricht die automatische Aktualisierung ab (z. B. abgelaufener
  Veo-Zugang), wird das spätestens nach einem Tag für jedes Mitglied des
  betroffenen Teams sichtbar, ohne dass zuvor unbemerkt veraltete oder
  falsche Daten als aktuell ausgegeben werden.
- **SC-004**: Kein Spiel erscheint nach wiederholten Sync-Läufen doppelt oder
  mit widersprüchlichen Werten in der Übersicht.

## Assumptions

- Der Verein hat einen eigenen, aktiven Veo-Account mit mindestens einem
  Team, dessen Spiele mit aktivierter Analyse aufgezeichnet werden.
- Die Platform-Admin-Rolle und ihre Einstellungs-Oberfläche gehören zum
  vorgelagerten, separaten Feature "Platform-Administration". Bis dieses
  Feature existiert, wird die Freischaltungsentscheidung über den
  dokumentierten Deployment-Operator-Prozess umgesetzt.
- Für den aktuellen Bedarf des Vereins wird zum Start genau ein
  Playerboard-Team über eine direkte SQL-Aktion freigeschaltet; das System
  schränkt die Anzahl möglicher Zuordnungen nicht künstlich ein.
- Täglicher Sync ist ausreichend zeitnah; ein Bedarf an Beinahe-Echtzeit-
  Updates direkt nach Spielende besteht nicht.
- Das erneute Herstellen des Veo-Zugangs, falls dieser abläuft oder ungültig
  wird, ist ein manueller, seltener administrativer Schritt außerhalb der
  normalen Nutzung durch Trainer/Spieler.
- Welche konkreten Statistik-Kategorien tatsächlich pro Spiel angezeigt
  werden, richtet sich danach, was Veo für dieses Spiel liefert; fehlen
  einzelne Kategorien bei Veo, fehlen sie auch in Playerboard, statt
  geschätzt zu werden.
