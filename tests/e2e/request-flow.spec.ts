// tests/e2e/request-flow.spec.ts
import { test, expect } from '@playwright/test'
import path from 'node:path'

const stateDir = path.join(process.cwd(), 'tests/e2e/storageState')

test.describe('request flow', () => {
  test('requester creates draft, edits, submits', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: path.join(stateDir, 'requester.json') })
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    await expect(page.getByText('申請・承認ダッシュボード')).toBeVisible()

    await page.goto('/requests/new')
    await page.getByLabel('タイトル（必須）').fill(`E2E: プリンター用紙 ${Date.now()}`)
    await page.getByLabel('内容（必須）').fill('E2Eテストで作成した申請です。')
    await page.getByRole('button', { name: '下書きを作成' }).click()

    // 作成後は詳細へリダイレクトされる設計
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+/)

    // DRAFT編集（存在する時だけ出る）
    await expect(page.getByText('下書きの編集（DRAFTのみ）')).toBeVisible()
    await page.getByLabel('タイトル（必須）').first().fill(`E2E: 更新済み ${Date.now()}`)
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('下書きを更新しました')).toBeVisible()

    // 提出
    await page.getByRole('button', { name: '提出' }).click()
    await page.getByRole('button', { name: /実行/i }).click()
    await expect(page.getByText(/操作が完了しました/)).toBeVisible()

    // ステータスが SUBMITTED になっていること（表示上）
    await expect(page.getByText('SUBMITTED')).toBeVisible()

    await ctx.close()
  })

  test('approver approves submitted request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: path.join(stateDir, 'approver.json') })
    const page = await ctx.newPage()

    await page.goto('/approvals')
    // 承認待ちが0の場合もあるので、0件ならテストはスキップ扱いで終了
    const empty = page.getByText('承認待ちはありません。')
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'No submitted requests in queue')
    }

    // 先頭を開く
    const first = page.locator('a[href^="/requests/"]').first()
    await first.click()
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+/)

    await page.getByRole('button', { name: '承認' }).click()
    await page.getByRole('button', { name: /実行/i }).click()
    await expect(page.getByText(/操作が完了しました/)).toBeVisible()
    await expect(page.getByText('APPROVED')).toBeVisible()

    await ctx.close()
  })
})