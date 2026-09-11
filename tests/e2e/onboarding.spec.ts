import { expect, test, type Page } from '@playwright/test'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const uniqueSuffix = () => Math.random().toString(36).slice(2, 8)

type MailpitMessage = {
  ID: string
  Created: string
  To: { Address: string }[]
  Subject: string
}

const fetchLatestMagicLink = async (email: string, matcher?: RegExp): Promise<string> => {
  const target = email.toLowerCase()
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=200`)
    if (listRes.ok) {
      const list = (await listRes.json()) as { messages: MailpitMessage[] }
      const relevant = list.messages
        .filter((m) => m.To.some((t) => t.Address.toLowerCase() === target))
        .sort((a, b) => (a.Created < b.Created ? 1 : -1))
      for (const m of relevant) {
        const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${m.ID}`)
        if (!msgRes.ok) continue
        const msg = (await msgRes.json()) as { HTML?: string; Text?: string }
        const body = msg.HTML ?? msg.Text ?? ''
        const urls = body.match(/https?:\/\/[^\s"<>]+/g) ?? []
        const link = urls.find((u) => (matcher ?? /token=|verify|invite\//i).test(u))
        if (link) {
          await fetch(`${MAILPIT_URL}/api/v1/messages`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ IDs: [m.ID] }),
          })
          return link.replace(/&amp;/g, '&')
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No magic link received for ${email}`)
}

const setupPage = (page: Page) => {
  page.on('pageerror', (err) => console.error(`[browser error] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`[browser console] ${msg.text()}`)
  })
}

const signInWithMagicLink = async (page: Page, email: string) => {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: /link senden/i })).toBeEnabled()
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByRole('button', { name: /link senden/i }).click()
  await expect(page.getByText(/prüfe deine e-mails/i)).toBeVisible({ timeout: 15_000 })
  const link = await fetchLatestMagicLink(email)
  await page.goto(link, { waitUntil: 'networkidle' })
}

test.describe('US0 — signup, team founding, invitation acceptance', () => {
  test('trainer signs up, founds a team, invites a player who accepts', async ({ browser }) => {
    test.setTimeout(120_000)
    const suffix = uniqueSuffix()
    const trainerEmail = `trainer-${suffix}@example.com`
    const playerEmail = `player-${suffix}@example.com`
    const teamName = `Test Team ${suffix}`
    const teamSlug = `test-team-${suffix}`

    const trainerCtx = await browser.newContext()
    const trainerPage = await trainerCtx.newPage()
    setupPage(trainerPage)

    await signInWithMagicLink(trainerPage, trainerEmail)
    await trainerPage.waitForURL(/\/start$/, { timeout: 15_000 })

    await trainerPage.getByLabel(/team-name/i).fill(teamName)
    await trainerPage.getByLabel(/slug/i).fill(teamSlug)
    await trainerPage.getByRole('button', { name: /team gründen/i }).click()
    await trainerPage.waitForURL(new RegExp(`/t/${teamSlug}(/|$)`), { timeout: 15_000 })

    await trainerPage.goto(`/t/${teamSlug}/team/members`, { waitUntil: 'networkidle' })
    await trainerPage.getByLabel(/e-mail/i).first().fill(playerEmail)
    await trainerPage.getByLabel(/rolle/i).selectOption('player')
    await trainerPage.getByRole('button', { name: /einladen/i }).click()
    await expect(trainerPage.getByText(playerEmail)).toBeVisible({ timeout: 10_000 })

    const inviteLink = await fetchLatestMagicLink(playerEmail)
    const playerCtx = await browser.newContext()
    const playerPage = await playerCtx.newPage()
    setupPage(playerPage)
    await playerPage.goto(inviteLink, { waitUntil: 'networkidle' })

    await expect(playerPage.getByText(new RegExp(teamName))).toBeVisible({ timeout: 15_000 })
    await playerPage.getByRole('button', { name: /annehmen/i }).click()
    await playerPage.waitForURL(new RegExp(`/t/${teamSlug}(/|$)`), { timeout: 15_000 })

    await playerPage.goto('/t/does-not-exist/dashboard', { waitUntil: 'networkidle' })
    await playerPage.waitForURL(/\/start$/, { timeout: 10_000 })

    await trainerCtx.close()
    await playerCtx.close()
  })
})
