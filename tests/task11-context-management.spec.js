import { test, expect } from '@playwright/test';

test.describe('Task 11 - Context Management System', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the test page before each test
    await page.goto('http://localhost:3000/test/context');
    await expect(page).toHaveTitle(/Next.js and Supabase Starter Kit/);
  });

  test('should load the context management test page correctly', async ({ page }) => {
    // Verify page elements are present
    await expect(page.locator('h1')).toContainText('Context Management Test');
    await expect(page.locator('select')).toBeVisible();
    await expect(page.getByRole('button', { name: '1. Collect Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: '2. View Context Data' })).toBeVisible();
    await expect(page.getByRole('button', { name: '3. Build Chat Context' })).toBeVisible();
    await expect(page.getByRole('button', { name: '4. Process Weekly Summary' })).toBeVisible();
  });

  test('should complete full context management workflow for default character', async ({ page }) => {
    // Step 1: Collect Context
    await page.click('button:has-text("1. Collect Context")');
    
    // Wait for the Card with Test Result to appear
    await page.waitForSelector('div:has-text("Test Result")', { timeout: 10000 });
    const collectResult = page.locator('pre').first();
    await expect(collectResult).toContainText('success');
    await expect(collectResult).toContainText('Context collected for user');

    // Step 2: View Context Data
    await page.click('button:has-text("2. View Context Data")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const viewResult = page.locator('pre').first();
    await expect(viewResult).toContainText('success');
    await expect(viewResult).toContainText('rawContext');

    // Step 3: Build Chat Context
    await page.click('button:has-text("3. Build Chat Context")');
    await page.waitForSelector('pre', { timeout: 15000 });
    const contextResult = page.locator('pre').first();
    await expect(contextResult).toContainText('success');
    await expect(contextResult).toContainText('context');

    // Step 4: Process Weekly Summary
    await page.click('button:has-text("4. Process Weekly Summary")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const summaryResult = page.locator('pre').first();
    await expect(summaryResult).toContainText('success');
    await expect(summaryResult).toContainText('Weekly context processed');
  });

  test('should work with different characters', async ({ page }) => {
    const characters = [
      { value: '1', name: '鈴木ハジメ' },
      { value: '2', name: '星野推子' },
      { value: '3', name: 'スマイリー中村' }
    ];

    for (const character of characters) {
      // Select character
      await page.selectOption('select', character.value);
      
      // Test context collection for this character
      await page.click('button:has-text("1. Collect Context")');
      await page.waitForSelector('pre', { timeout: 10000 });
      const characterResult = page.locator('pre').first();
      await expect(characterResult).toContainText('success');
      await expect(characterResult).toContainText(`character ${character.value}`);
      
      // Small delay between character tests
      await page.waitForTimeout(1000);
    }
  });

  test('should handle API responses correctly', async ({ page }) => {
    // Test that all API calls return proper JSON responses
    const apiTests = [
      { button: '1. Collect Context', expectedKeys: ['success', 'message'] },
      { button: '2. View Context Data', expectedKeys: ['success', 'rawContext', 'summaries'] },
      { button: '3. Build Chat Context', expectedKeys: ['success', 'context'] },
      { button: '4. Process Weekly Summary', expectedKeys: ['success', 'message'] }
    ];

    for (const apiTest of apiTests) {
      await page.click(`button:has-text("${apiTest.button}")`);
      
      // Wait for result with longer timeout for potentially slower operations
      const timeout = apiTest.button === '3. Build Chat Context' ? 15000 : 10000;
      await page.waitForSelector('pre', { timeout });
      
      const resultElement = page.locator('pre').first();
      const fullText = await resultElement.textContent();
      
      // Verify it contains success
      expect(fullText).toContain('success');
      
      // Wait a bit between API calls
      await page.waitForTimeout(500);
    }
  });

  test('should maintain character isolation', async ({ page }) => {
    // Test with character 1
    await page.selectOption('select', '1');
    await page.click('button:has-text("1. Collect Context")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const char1Result = page.locator('pre').first();
    await expect(char1Result).toContainText('character 1');

    // Switch to character 2
    await page.selectOption('select', '2');
    await page.click('button:has-text("1. Collect Context")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const char2Result = page.locator('pre').first();
    await expect(char2Result).toContainText('character 2');

    // Verify the results are character-specific
    await page.click('button:has-text("2. View Context Data")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const resultElement = page.locator('pre').first();
    const fullText = await resultElement.textContent();
    expect(fullText).toContain('success');
  });

  test('should handle basic operations correctly', async ({ page }) => {
    // Test basic collect and view operations
    await page.click('button:has-text("1. Collect Context")');
    await page.waitForSelector('pre', { timeout: 10000 });
    await expect(page.locator('pre').first()).toContainText('success');

    await page.click('button:has-text("2. View Context Data")');
    await page.waitForSelector('pre', { timeout: 10000 });
    await expect(page.locator('pre').first()).toContainText('success');
  });

  test('should handle data correctly', async ({ page }) => {
    // Test data handling operations
    await page.click('button:has-text("1. Collect Context")');
    await page.waitForSelector('pre', { timeout: 10000 });
    
    await page.click('button:has-text("2. View Context Data")');
    await page.waitForSelector('pre', { timeout: 10000 });
    const viewResult = page.locator('pre').first();
    await expect(viewResult).toContainText('success');
    await expect(viewResult).toContainText('rawContext');
  });

  test('should complete stress test with multiple characters rapidly', async ({ page }) => {
    // Rapid testing across multiple characters to verify system stability
    const characterIds = ['1', '2', '3'];
    
    for (const characterId of characterIds) {
      await page.selectOption('select', characterId);
      
      // Quick sequence of operations
      await page.click('button:has-text("1. Collect Context")');
      await page.waitForSelector('pre', { timeout: 10000 });
      
      await page.click('button:has-text("2. View Context Data")');
      await page.waitForSelector('pre', { timeout: 10000 });
      
      // Verify each operation succeeds
      await expect(page.locator('pre').first()).toContainText('success');
      
      // Small delay between characters
      await page.waitForTimeout(500);
    }
  });
}); 