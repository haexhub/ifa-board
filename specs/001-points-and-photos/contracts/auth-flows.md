# Contract: Auth & Onboarding Flows (Round 2)

**Feature**: 001-points-and-photos
**Spec reference**: FR-004..008, FR-070..074, US0, A14..A17

Passwordless via Supabase magic-link. Rollen entstehen über
Memberships; ohne Membership sieht der Nutzer nur die Onboarding-Seiten.

---

## Flow A — Neu-Registrierung ohne Einladung

```text
Browser → /login
   ↓  Email eingeben, "Link senden"
Supabase Auth → sends magic-link email
   ↓  Klick → callback URL: /callback
Nuxt /callback → session gesetzt
   ↓  useAuth checks memberships
kein Membership → redirect /start
```

`/start` zeigt: "Team gründen" (Weiter-Button) und "Einladungen an
diese Adresse ansehen" (falls Invitations mit `email = auth.email`
vorhanden). Der Nutzer trägt beim ersten `/start`-Besuch außerdem
seinen Anzeigenamen ein; der Wert wird nach
`auth.users.user_metadata.display_name` geschrieben.

## Flow B — Team gründen

```text
/start → "Team gründen" → Formular (name; optional slug)
   ↓  Submit
POST /api/teams/create   (service_role)
   1. slug ableiten (`slug(name)`, Kollisions-Suffix)
   2. insert into teams(name, slug, created_by=auth.uid())
   3. insert into memberships(user_id=auth.uid(), team_id=new.id, role='trainer')
   4. insert into team_settings(team_id=new.id) via trigger
   ↓  Response: { slug }
Nuxt → redirect /t/<slug>
```

## Flow C — Einladen eines Nutzers durch einen Trainer

```text
Trainer (in /t/<slug>/team/members) → "Einladen" Dialog
   ↓  Email + Rolle (trainer|player) wählen
POST /api/invitations/issue   (trainer-only)
   verifiziert: is_trainer(team_id) für den Caller
   1. token generieren (32 Zeichen URL-safe)
   2. insert into invitations(team_id, email, role, token, invited_by, expires_at=now()+14d)
   3. supabase.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: <origin>/invite/<token> }
      )
   ↓
Recipient inbox: Supabase-Magic-Link → beim Klick → /callback → /invite/<token>
```

## Flow D — Einladung annehmen

```text
Recipient klickt Link:
   Fall 1: bereits eingeloggt (Session vorhanden)
      → /invite/<token> zeigt Karte "<TeamName> — Rolle: <role>"
      → "Annehmen" ruft POST /api/invitations/accept
   Fall 2: nicht eingeloggt
      → /login mit `?redirect=/invite/<token>` und der Email vorbelegt
      → Magic-Link → /callback → weiter zu /invite/<token>

POST /api/invitations/accept   (authenticated)
   1. row lookup: token gültig, nicht expired, nicht accepted
   2. Wenn Row-`email` ≠ session-`email`: serverseitig ablehnen (400/403).
      Der Request enthält kein `force`-Flag; ein weitergeleiteter Token darf
      keine Membership für eine andere Session anlegen.
   3. Eine transaktionale Datenbankfunktion validiert die Einladung erneut und
      legt Membership und `accepted_at` atomar an; bei Fehlern wird alles
      zurückgerollt. `on conflict (user_id, team_id) do nothing` macht den
      zweiten Klick harmlos.

Nuxt → redirect /t/<slug>
```

## Flow E — Sign-in eines existierenden Nutzers

Identisch zu Flow A (Magic-Link), aber `useAuth` findet mindestens eine
Membership. Weiterleitung auf `/t/<lastSlug>` (aus `localStorage`) oder
auf `/t/<slugs[0]>` falls kein Persist-Wert.

## Guards und Middlewares

- `auth.global.ts`: alle Routen außer
  `/login`, `/callback`, `/public/**`, `/invite/**` erfordern Session.
- `team-context.ts` (matcht `/t/[slug]/**`): erfordert
  `is_member(team_id_of(slug))` — sonst redirect `/start`.
- `trainer-only.ts` (matcht `/t/[slug]/trainings/new`,
  `/t/[slug]/players/**`, `/t/[slug]/categories/**`, `/t/[slug]/team/**`
  außer `settings.vue` read-only-Ansicht für player): erfordert
  `is_trainer(team_id_of(slug))`.

## Fehlerfälle

| Situation | UX |
|---|---|
| Magic-Link abgelaufen (Supabase default: 1 h) | `/callback` zeigt "Link abgelaufen — bitte neu anfordern" |
| Einladung abgelaufen | `/invite/<token>` zeigt "Einladung abgelaufen"; angebotener Weg: den einladenden Trainer benachrichtigen |
| Einladung schon angenommen | Nutzer bleibt eingeloggt und wird auf `/t/<slug>` geleitet |
| Nutzer versucht `POST /api/invitations/accept` mit fremder Session | 403 |
| Slug-Kollision beim Team-Anlegen (manueller Slug) | 409 mit Feld-Error |
| Letzter Trainer versucht sich zu entfernen | 409 mit Meldung "Team braucht mindestens einen Trainer" (kommt aus dem Trigger) |
