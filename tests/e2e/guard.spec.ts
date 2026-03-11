// tests/e2e/guard.spec.ts
import { test, expect } from '@playwright/test'

test('unauthenticated user is redirected to /login', async ({ page }) => {
  // storageState を使わずにアクセス（未ログイン）
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()
})