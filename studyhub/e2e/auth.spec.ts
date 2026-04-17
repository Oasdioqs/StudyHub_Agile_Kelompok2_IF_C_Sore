import { test, expect } from '@playwright/test'

// Catatan: form tidak pakai htmlFor di label, jadi gunakan getByPlaceholder()

test.describe('Authentication Flow', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page).toHaveTitle(/StudyHub/i)
    await expect(page.getByRole('heading', { name: 'Masuk ke StudyHub' })).toBeVisible()
    await expect(page.getByPlaceholder('nama@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('Minimal 8 karakter')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible()
  })

  test('submit button disabled ketika form belum lengkap', async ({ page }) => {
    await page.goto('/auth/login')

    // Button disabled karena isLoginValid = false (email & password kosong)
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeDisabled()
  })

  test('submit button aktif setelah email dan password valid diisi', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByPlaceholder('nama@email.com').fill('user@example.com')
    await page.getByPlaceholder('Minimal 8 karakter').fill('password123')

    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByPlaceholder('nama@email.com').fill('notexist@example.com')
    await page.getByPlaceholder('Minimal 8 karakter').fill('wrongpassword')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()

    // Tunggu alert danger muncul (element dengan class alert-danger)
    await expect(page.locator('.alert-danger')).toBeVisible({ timeout: 15000 })
  })

  test('register page loads correctly', async ({ page }) => {
    await page.goto('/auth/register')

    await expect(page.getByPlaceholder('Claire123')).toBeVisible()
    await expect(page.getByPlaceholder('nama@gmail.com')).toBeVisible()
    await expect(page.getByPlaceholder('Minimal 8 karakter').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Daftar Sekarang/i })).toBeVisible()
  })

  test('register button disabled ketika form kosong', async ({ page }) => {
    await page.goto('/auth/register')

    await expect(page.getByRole('button', { name: /Daftar Sekarang/i })).toBeDisabled()
  })

  test('redirect unauthenticated user dari dashboard ke login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/auth/forgot-password')

    await expect(page.getByPlaceholder('contoh@email.com')).toBeVisible()
    await expect(page.getByRole('button', { name: /kirim|send|reset/i })).toBeVisible()
  })

  test('ada link ke register dari halaman login', async ({ page }) => {
    await page.goto('/auth/login')

    const registerLink = page.getByRole('link', { name: /Daftar gratis/i })
    await expect(registerLink).toBeVisible()
    await registerLink.click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })
})
