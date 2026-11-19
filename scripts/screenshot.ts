/**
 * Visual QA: starts the dev server, plays through a hand at desktop and phone
 * sizes, and saves screenshots to screenshots/. Fails on any console error.
 *
 *   npm run screenshot            (uses ?seed=7 for a reproducible table)
 *   SEED=42 npm run screenshot
 */
import { chromium, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 5317
const BASE = `http://localhost:${PORT}`
const SEED = process.env.SEED ?? '7'
const OUT = 'screenshots'

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(300)
  }
  throw new Error(`Dev server did not start at ${url}`)
}

const attr = (page: Page, name: string) => page.getByTestId('table').getAttribute(name)

async function waitFor(pred: () => Promise<boolean>, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await pred().catch(() => false)) return true
    await sleep(150)
  }
  return false
}

async function heroTurn(page: Page) {
  return (await attr(page, 'data-hero-turn')) === '1'
}

/** Click check/call (never fold) so the hand goes as deep as possible. */
async function passiveAct(page: Page) {
  await page.keyboard.press('c')
}

async function run() {
  mkdirSync(OUT, { recursive: true })
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  const errors: string[] = []
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.mobile ? 2 : 1,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
      })
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem(
            'neon-holdem:settings',
            JSON.stringify({
              bots: 5,
              startingStackBB: 100,
              blindsIndex: 1,
              speed: 'fast',
              sound: false,
              mode: 'coach',
            }),
          )
        } catch {
          /* ignore */
        }
      })
      const page = await ctx.newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`[${vp.name}] console.error: ${m.text()}`)
      })
      page.on('pageerror', (e) => errors.push(`[${vp.name}] pageerror: ${e.message}`))
      const shot = (n: string) => page.screenshot({ path: `${OUT}/${vp.name}-${n}.png` })

      await page.goto(`${BASE}/?seed=${SEED}`)
      await sleep(1800)
      await shot('1-landing')

      await page.getByRole('button', { name: /PLAY/ }).first().click()
      let gotShowdown = false
      let gotFlop = false
      let gotCoach = false
      let gotDeal = false
      for (let hand = 0; hand < 10 && !(gotShowdown && gotFlop && gotCoach); hand++) {
        // Deal complete: hole cards have landed and flipped
        await sleep(3400)
        if (!gotDeal) {
          await shot('2-deal-complete')
          gotDeal = true
        }
        for (let step = 0; step < 60; step++) {
          const phase = await attr(page, 'data-phase')
          if (phase === 'handComplete') break
          if (await heroTurn(page)) {
            const street = await attr(page, 'data-street')
            if (!gotCoach) {
              await sleep(900)
              if (vp.mobile) {
                await page.getByRole('button', { name: /WHY/ }).click()
                await sleep(700)
              }
              await shot('4-coach-panel')
              if (vp.mobile) {
                await page.keyboard.press('Escape')
                await page.mouse.click(vp.width / 2, 40)
                await sleep(500)
              }
              gotCoach = true
            }
            if (street === 'flop' && !gotFlop) {
              await sleep(700)
              await shot('3-flop')
              gotFlop = true
            }
            await passiveAct(page)
          }
          await sleep(250)
        }
        // Showdown?
        await waitFor(async () => (await attr(page, 'data-phase')) === 'handComplete', 20000)
        if ((await attr(page, 'data-showdown')) === '1' && !gotShowdown) {
          await sleep(2300)
          await shot('5-showdown')
          gotShowdown = true
          await waitFor(async () => (await page.getByRole('dialog').count()) > 0, 6000)
          await sleep(900)
          await shot('6-summary')
        }
        // next hand
        await waitFor(
          async () => (await page.getByRole('button', { name: /DEAL NEXT HAND/ }).count()) > 0,
          8000,
        )
        await page
          .getByRole('button', { name: /DEAL NEXT HAND/ })
          .click()
          .catch(() => undefined)
      }
      if (!gotShowdown) errors.push(`[${vp.name}] never reached a showdown`)
      await ctx.close()
    }
    await browser.close()
  } finally {
    server.kill()
  }
  if (errors.length) {
    console.error('Console errors:\n' + errors.join('\n'))
    process.exit(1)
  }
  console.log(`Screenshots saved to ${OUT}/`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
