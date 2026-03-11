// tests/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'tests/e2e/storageState')
fs.mkdirSync(dir, { recursive: true })

function must(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function signIn(page: any, email: string, password: string) {
  await page.goto('/login')

  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(password)

  await page.locator('button.btn.btn-primary', { hasText: 'ログイン' }).click()

  await expect(page).toHaveURL(/\/dashboard/)
}

setup('auth: requester', async ({ page }) => {
  await signIn(page, must('E2E_REQUESTER_EMAIL'), must('E2E_REQUESTER_PASSWORD'))
  await page.context().storageState({ path: path.join(dir, 'requester.json') })
})

setup('auth: approver', async ({ page }) => {
  await signIn(page, must('E2E_APPROVER_EMAIL'), must('E2E_APPROVER_PASSWORD'))
  await page.context().storageState({ path: path.join(dir, 'approver.json') })
})

setup('auth: admin', async ({ page }) => {
  await signIn(page, must('E2E_ADMIN_EMAIL'), must('E2E_ADMIN_PASSWORD'))
  await page.context().storageState({ path: path.join(dir, 'admin.json') })
})