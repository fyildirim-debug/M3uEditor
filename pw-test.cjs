/* Canli sitede: kayit ol -> sayfayi yenile -> oturum duruyor mu? */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', (r) => {
    if (r.url().includes('/api/auth/')) console.log('  API', r.request().method(), r.url().replace('https://m3ueditor.arnexlab.com',''), '->', r.status());
  });

  const email = `pw-test-${Date.now()}@ornek.test`;
  const password = 'Playwright-Test-Parolasi-321!';

  console.log('1) kayit sayfasi aciliyor');
  await page.goto('https://m3ueditor.arnexlab.com/#/register', { waitUntil: 'networkidle', timeout: 45000 });
  await page.screenshot({ path: '/tmp/pw-1-register.png' });

  const emailInput = page.locator('input[type="email"]').first();
  if (!await emailInput.count()) {
    console.log('  kayit formu bulunamadi, sayfa basligi:', await page.title());
    console.log('  govde:', (await page.locator('body').innerText()).slice(0, 300));
    await browser.close();
    return;
  }
  await emailInput.fill(email);
  const passwords = page.locator('input[type="password"]');
  const count = await passwords.count();
  for (let i = 0; i < count; i++) await passwords.nth(i).fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  console.log('  kayit sonrasi adres:', page.url());
  const tokenAfterRegister = await page.evaluate(() => sessionStorage.getItem('token'));
  console.log('  sessionStorage token:', tokenAfterRegister ? 'VAR' : 'YOK');
  await page.screenshot({ path: '/tmp/pw-2-after-register.png' });

  console.log('2) SAYFA YENILENIYOR (F5)');
  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);
  const tokenAfterReload = await page.evaluate(() => sessionStorage.getItem('token'));
  console.log('  yenileme sonrasi adres:', page.url());
  console.log('  sessionStorage token:', tokenAfterReload ? 'VAR' : 'YOK');
  console.log('  SONUC:', page.url().includes('/login') || !tokenAfterReload ? 'OTURUM KAYBOLDU' : 'oturum korundu');
  await page.screenshot({ path: '/tmp/pw-3-after-reload.png' });

  if (errors.length) console.log('  konsol hatalari:', errors.slice(0, 5));
  console.log('  kullanici:', email);
  await browser.close();
})().catch((e) => { console.error('PATLADI:', e.message); process.exit(1); });
