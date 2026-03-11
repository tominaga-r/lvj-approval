// tests/e2e/guard.spec.ts
import { test, expect } from '@playwright/test'
import path from 'node:path'

const stateDir = path.join(process.cwd(), 'tests/e2e/storageState')

test('admin adds request_type and it appears in /requests/new', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: path.join(stateDir, 'admin.json') })
  const page = await ctx.newPage()

  const typeName = `E2E種別-${Date.now()}`

  await page.goto('/admin')
  await expect(page.getByText('管理（ADMIN）')).toBeVisible()

  // 「追加」欄に入力して追加（AdminClient側の placeholder を使う）
  await page.getByPlaceholder('新しい種別名（例：店舗備品購入申請）').fill(typeName)
  await page.getByRole('button', { name: '追加' }).click()
  await expect(page.getByText('更新しました')).toBeVisible()

  // requester で /requests/new を開いて、プルダウンに追加された種別があることを確認
  const requesterCtx = await browser.newContext({
    storageState: path.join(stateDir, 'requester.json'),
  })
  const requesterPage = await requesterCtx.newPage()

  await requesterPage.goto('/requests/new')
  await expect(requesterPage.getByRole('heading', { name: /新規申請/ })).toBeVisible()

  // optionは visible 判定にならないことがあるので、select自体で検証する
  const typeSelect = requesterPage.locator('select').first()

  // 「選択肢として存在する」ことの検証（文字列が含まれる）
  await expect(typeSelect).toContainText(typeName)

  // さらに「実際に選べる」ことまで検証したい場合（おすすめ）
  await typeSelect.selectOption({ label: typeName })
  await expect(typeSelect).toHaveValue(/^\d+$/)

  await requesterCtx.close()
  await ctx.close()
})