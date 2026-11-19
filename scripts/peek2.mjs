import { chromium } from '@playwright/test'
const [out, w, h] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h } })
const errs = []
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text()))
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto('http://localhost:5199')
await p.waitForTimeout(1600)
await p.screenshot({ path: out + '-landing.png' })
await p.getByRole('button', { name: /PLAY/ }).first().click()
await p.waitForTimeout(1200)
await p.screenshot({ path: out + '-dealing.png' })
// wait until it's our turn
for (let i = 0; i < 40; i++) {
  const enabled = await p.getByRole('button', { name: /FOLD/ }).isEnabled().catch(() => false)
  if (enabled) break
  await p.waitForTimeout(500)
}
await p.waitForTimeout(1200)
await p.screenshot({ path: out + '-turn.png' })
console.log(errs.slice(0, 20).join('\n'))
await b.close()
