import { chromium } from '@playwright/test'
const [url, out, w, h] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w || 1440, height: +h || 900 } })
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(url)
await p.waitForTimeout(1500)
await p.screenshot({ path: out })
console.log('errors:', errs)
await b.close()
