#!/usr/bin/env node
/**
 * Recapture user-guide screenshots against the local Vite app.
 * Usage: node docs/_capture_user_guide_screens.mjs
 * Requires Playwright Chromium and npm run dev on BASE_URL (default http://127.0.0.1:5173).
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const ASSETS = path.join(ROOT, 'user-guide-assets')
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const PASSWORD = 'password123'

async function shot(page, filename, { fullPage = false } = {}) {
  const dest = path.join(ASSETS, filename)
  await page.waitForTimeout(250)
  await page.screenshot({ path: dest, fullPage, type: 'png' })
  console.log('saved', filename)
}

async function dismissOverlays(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
}

async function openUserMenu(page) {
  await dismissOverlays(page)
  await page.getByRole('banner').locator('button').last().click()
}

async function login(page, accountLabel) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: new RegExp(`^${accountLabel}\\b`) }).click()
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  await page.waitForTimeout(400)
}

async function logout(page) {
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Logout' }).click()
  await page.waitForURL('**/login')
}

async function resetDemo(page) {
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Reset Demo Data' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset Demo Data' }).click()
  await page.waitForTimeout(500)
}

async function gotoPath(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

async function directRelease(page, { optionName, amount, paymentRef, notes }) {
  await gotoPath(page, '/funding')
  await page.getByRole('button', { name: 'Direct Release' }).click()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: optionName }).click()
  await page.locator('#transfer-amount').fill(String(amount))
  if (notes) await page.locator('#transfer-notes').fill(notes)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('#funding-payment-ref').fill(paymentRef)
  await page.getByRole('button', { name: 'Release Credits' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(400)
}

async function recordDemoSale(page, amount) {
  await gotoPath(page, '/transactions')
  await page.getByRole('button', { name: 'Record demo sale' }).click()
  await page.locator('#demo-product').fill('Fiber 50 Mbps')
  await page.locator('#demo-amount').fill(String(amount))
  await page.getByRole('button', { name: 'Record sale' }).click()
  await page.waitForTimeout(500)
  await dismissOverlays(page)
}

async function openFirstTableView(page) {
  const view = page.getByRole('button', { name: /^View / }).first()
  await view.click()
  await page.waitForTimeout(400)
}

async function pickBalanceRetailer(page, optionName) {
  const heading = page.getByRole('heading', {
    name: 'Internet Retailer Balance Report',
  }).first()
  await heading.scrollIntoViewIfNeeded()
  const card = heading.locator(
    'xpath=ancestor::div[contains(@class,"overflow-hidden")][1]',
  )
  await card.getByRole('combobox').click()
  await page.getByRole('option', { name: optionName }).click()
  await page.waitForTimeout(400)
}

async function shotReports(page, pageFile, exportFile, { pickRetailer } = {}) {
  await gotoPath(page, '/reports')
  if (pickRetailer) {
    await pickBalanceRetailer(page, pickRetailer)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await shot(page, pageFile)
  await page.getByRole('heading', { name: 'Export Reports' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await shot(page, exportFile)
}

async function main() {
  await mkdir(ASSETS, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await shot(page, 'login.png', { fullPage: true })

  await login(page, 'Sub-Franchisee')
  await resetDemo(page)
  await directRelease(page, {
    optionName: /Franchisee A/,
    amount: 7000,
    paymentRef: 'UG-SUB-FRAN-A-001',
    notes: 'User-guide walkthrough load to Franchisee A',
  })
  await logout(page)

  await login(page, 'Franchisee A')
  await directRelease(page, {
    optionName: /Retailer A/,
    amount: 8000,
    paymentRef: 'UG-FRAN-RET-A-001',
    notes: 'User-guide walkthrough load to Retailer A',
  })
  await logout(page)

  await login(page, 'Sub-Franchisee')
  await directRelease(page, {
    optionName: /Franchisee A/,
    amount: 1750,
    paymentRef: 'UG-SUB-FRAN-A-002',
    notes: 'Stock for Retailer B low-balance shot',
  })
  await logout(page)

  await login(page, 'Franchisee A')
  await directRelease(page, {
    optionName: /Retailer B/,
    amount: 2000,
    paymentRef: 'UG-FRAN-RET-B-001',
    notes: 'User-guide walkthrough load to Retailer B',
  })
  await logout(page)

  await login(page, 'Retailer A')
  await recordDemoSale(page, 1000)
  await logout(page)

  // Sub-Franchisee pages (after loads + sale)
  await login(page, 'Sub-Franchisee')
  await gotoPath(page, '/wallet-management')
  await shot(page, 'sub-wallets.png')

  await gotoPath(page, '/funding')
  await page.getByRole('tab', { name: /My Credits Request/ }).click()
  await shot(page, 'sub-credits-mine.png')
  await page.getByRole('button', { name: 'New Credits Request' }).click()
  await page.getByRole('dialog', { name: 'New Credits Request' }).waitFor()
  await page.locator('#funding-amount').fill('30000')
  await shot(page, 'sub-credits-new-request.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /Downlines Credits Request/ }).click()
  await shot(page, 'sub-credits-downlines.png')
  await page.getByRole('button', { name: 'Direct Release' }).click()
  await page.getByRole('dialog', { name: 'Direct Credits Release' }).waitFor()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /Franchisee A/ }).click()
  await page.locator('#transfer-amount').fill('7000')
  await shot(page, 'sub-credits-direct-release.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /Released \/ History/ }).click()
  await shot(page, 'sub-credits-released.png')

  await gotoPath(page, '/deposit-rates')
  await shot(page, 'sub-deposit-rates.png')
  await gotoPath(page, '/commission-settings')
  await shot(page, 'sub-commission-settings.png')
  await gotoPath(page, '/transactions')
  await shot(page, 'sub-transactions.png')
  await gotoPath(page, '/revenue')
  await shot(page, 'sub-revenue.png')
  await shotReports(page, 'sub-reports.png', 'sub-reports-export.png', {
    pickRetailer: /Retailer A/,
  })
  await logout(page)

  // Franchisee A
  await login(page, 'Franchisee A')
  await gotoPath(page, '/wallet-management')
  await shot(page, 'fran-wallets.png')
  await openFirstTableView(page)
  await shot(page, 'fran-wallet-details.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  await gotoPath(page, '/funding')
  await page.getByRole('tab', { name: /My Credits Request/ }).click()
  await shot(page, 'fran-credits-mine.png')
  await page.getByRole('button', { name: 'New Credits Request' }).click()
  await page.getByRole('dialog', { name: 'New Credits Request' }).waitFor()
  await page.locator('#funding-amount').fill('10000')
  await shot(page, 'fran-credits-new-request.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /Retailers Credits Request/ }).click()
  await shot(page, 'fran-credits-retailers.png')
  await page.getByRole('button', { name: 'Direct Release' }).click()
  await page.getByRole('dialog', { name: 'Direct Credits Release' }).waitFor()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /Retailer A/ }).click()
  await page.locator('#transfer-amount').fill('8000')
  await shot(page, 'fran-credits-direct-release.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /Released \/ History/ }).click()
  await shot(page, 'fran-credits-released.png')

  await gotoPath(page, '/deposit-rates')
  await shot(page, 'fran-deposit-rates.png')
  await gotoPath(page, '/transactions')
  await shot(page, 'fran-transactions.png')
  await openFirstTableView(page)
  await shot(page, 'fran-transaction-details.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  await gotoPath(page, '/revenue')
  await shot(page, 'fran-revenue.png')
  await shotReports(page, 'fran-reports.png', 'fran-reports-export.png', {
    pickRetailer: /Retailer A/,
  })
  await logout(page)

  // Retailer A
  await login(page, 'Retailer B')
  await gotoPath(page, '/wallet')
  await shot(page, 'ret-wallet-low-balance.png')
  await logout(page)

  await login(page, 'Retailer A')
  await gotoPath(page, '/wallet')
  await shot(page, 'ret-wallet.png')

  await gotoPath(page, '/request-funding')
  await page.getByRole('tab', { name: /My Credits Request/ }).click()
  await shot(page, 'ret-credits-mine.png')
  await page.getByRole('button', { name: 'New Credits Request' }).click()
  await page.getByRole('dialog', { name: 'New Credits Request' }).waitFor()
  await page.locator('#funding-amount').fill('1600')
  await shot(page, 'ret-credits-new-request.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /Released \/ History/ }).click()
  await shot(page, 'ret-credits-released.png')

  await gotoPath(page, '/transactions')
  await shot(page, 'ret-transactions.png')
  await openFirstTableView(page)
  await shot(page, 'ret-transaction-details.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  await gotoPath(page, '/revenue')
  await shot(page, 'ret-revenue.png')
  await shotReports(page, 'ret-reports.png', 'ret-reports-export.png')

  await browser.close()
  console.log('All user-guide screenshots captured.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
