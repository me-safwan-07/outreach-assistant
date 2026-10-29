import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("Starting Chrome...");
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,1050',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true });

  await sleep(1500);

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${PORT}/json`);
    const targets = await targetsRes.json();
    const wsUrl = targets[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error("Could not get webSocketDebuggerUrl");

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Page.enable');
    await sendCommand('Network.enable');

    const pages = [
      { url: 'http://localhost:3000', name: 'homepage.png' },
      { url: 'http://localhost:3000/companies/cmuo5jk880000b5rmh17sx6u4', name: 'company_leads.png' },
      { url: 'http://localhost:3000/dashboard', name: 'dashboard.png' }
    ];

    const outDir = path.resolve('public', 'screenshots');
    const brainDir = path.resolve('C:\\Users\\amrin\\.gemini\\antigravity-ide\\brain\\be6c4933-4f01-493d-a1fe-3f3dcacc8758');

    for (const p of pages) {
      console.log(`Navigating to ${p.url}...`);
      await sendCommand('Page.navigate', { url: p.url });
      await sleep(3500);

      const shot = await sendCommand('Page.captureScreenshot', { format: 'png', quality: 90 });
      const buffer = Buffer.from(shot.data, 'base64');
      
      const targetPath1 = path.join(outDir, p.name);
      fs.writeFileSync(targetPath1, buffer);
      console.log(`Saved ${targetPath1} (${buffer.length} bytes)`);

      const targetPath2 = path.join(brainDir, p.name);
      fs.writeFileSync(targetPath2, buffer);
      console.log(`Saved ${targetPath2}`);
    }

    // Now capture email drawer by clicking Review button
    console.log("Navigating to company page and clicking Review...");
    await sendCommand('Page.navigate', { url: 'http://localhost:3000/companies/cmuo5jk880000b5rmh17sx6u4' });
    await sleep(3500);

    await sendCommand('Runtime.enable');
    await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const reviewBtn = buttons.find(b => b.textContent && b.textContent.includes('Review'));
        if (reviewBtn) reviewBtn.click();
      })()`
    });
    await sleep(1500);

    const drawerShot = await sendCommand('Page.captureScreenshot', { format: 'png', quality: 90 });
    const drawerBuffer = Buffer.from(drawerShot.data, 'base64');
    fs.writeFileSync(path.join(outDir, 'email_draft.png'), drawerBuffer);
    fs.writeFileSync(path.join(brainDir, 'email_draft.png'), drawerBuffer);
    console.log("Saved email_draft.png successfully!");

    ws.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch (e) {}
  }
}

run().catch(console.error);
