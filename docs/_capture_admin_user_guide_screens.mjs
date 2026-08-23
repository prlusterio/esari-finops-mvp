#!/usr/bin/env node
/**
 * Capture admin-user-guide screenshots against the local Vite app.
 * Usage: node docs/_capture_admin_user_guide_screens.mjs
 * Requires Playwright Chromium and npm run dev on BASE_URL (default http://127.0.0.1:5173).
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const ASSETS = path.join(ROOT, 'admin-user-guide-assets')
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const ADMIN_PASSWORD = 'abc12345678'

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

async function loginAdmin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Admin\b/ }).click()
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  await page.waitForTimeout(400)
}

async function resetDemo(page) {
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Reset Demo Data' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset Demo Data' })
    .click()
  await page.waitForTimeout(500)
}

async function gotoPath(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

async function fillClientInfo(page) {
  const fields = {
    'admin-first-name': 'Maria',
    'admin-last-name': 'Reyes',
    'admin-email': 'maria.reyes@example.com',
    'admin-password': 'password1',
    'admin-password-confirm': 'password1',
    'company-name': 'Caraga Demo Hub Co.',
    'registration-number': 'REG-240824',
    'tax-id': 'TIN-001-234',
    'corp-email': 'ops@caragademohub.example',
    'corp-phone': '09171234567',
    'address-one': '12 Bonifacio Street',
    'address-two': 'Unit 4B',
    'city-municipality': 'Surigao City',
    'state-province-region': 'Surigao del Norte',
    country: 'Philippines',
    'postal-zip': '8400',
    'contact-full-name': 'Jose Cruz',
    'contact-email': 'jose.cruz@example.com',
    'contact-phone': '09189876543',
  }
  for (const [id, value] of Object.entries(fields)) {
    const locator = page.locator(`#${id}`)
    if ((await locator.count()) === 0) continue
    await locator.fill(value)
  }
}

async function main() {
  await mkdir(ASSETS, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Admin\b/ }).click()
  await page.waitForTimeout(200)
  await shot(page, 'admin-01-login.png')

  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  await page.waitForTimeout(400)
  await resetDemo(page)

  await gotoPath(page, '/dashboard')
  await shot(page, 'admin-02-dashboard.png', { fullPage: true })

  const confirmButtons = page.getByRole('button', { name: 'Confirm Collection' })
  if ((await confirmButtons.count()) > 0) {
    await confirmButtons.first().click()
    await page.waitForTimeout(300)
    await shot(page, 'admin-03-dashboard-confirm.png')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }

  await gotoPath(page, '/franchise-setup/clients')
  await shot(page, 'admin-04-clients.png', { fullPage: true })

  await page.getByRole('link', { name: 'View' }).first().click()
  await page.waitForURL('**/franchise-setup/clients/**')
  await page.waitForTimeout(400)
  await shot(page, 'admin-05-client-detail.png', { fullPage: true })

  await gotoPath(page, '/franchise-setup/onboarding/step-1')
  await fillClientInfo(page)
  await shot(page, 'admin-06-onboarding-step-1.png', { fullPage: true })

  await page.getByRole('button', { name: /Continue to Step 2/ }).click()
  await page.waitForURL('**/onboarding/step-2')
  await page.waitForTimeout(400)
  await shot(page, 'admin-07-onboarding-step-2.png', { fullPage: true })

  await page.getByRole('link', { name: /Continue to Step 3/ }).click()
  await page.waitForURL('**/onboarding/step-3')
  await page.waitForTimeout(400)
  await shot(page, 'admin-08-onboarding-step-3.png', { fullPage: true })

  await page.getByRole('link', { name: /Continue to Review/ }).click()
  await page.waitForURL('**/onboarding/step-4')
  await page.waitForTimeout(400)
  await shot(page, 'admin-09-onboarding-step-4.png', { fullPage: true })

  await gotoPath(page, '/dashboard')
  await openUserMenu(page)
  await page.waitForTimeout(200)
  await shot(page, 'admin-10-user-menu.png')

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
