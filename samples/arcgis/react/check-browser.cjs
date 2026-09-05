/**
 * Headless browser check — opens the React app, captures console output,
 * JS errors, network failures, and simulates a pointer-down on the map to
 * test whether onStrokeStart fires.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];

  // Capture every console message
  page.on('console', msg => {
    logs.push(`[console.${msg.type()}] ${msg.text()}`);
  });

  // Capture uncaught page errors
  page.on('pageerror', err => {
    logs.push(`[PAGE ERROR] ${err.message}`);
  });

  // Capture failed network requests
  page.on('requestfailed', req => {
    logs.push(`[NET FAIL] ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
  });

  // Navigate (port may vary)
  const port = process.argv[2] || '5174';
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => {
    logs.push(`[NAVIGATION ERROR] ${e.message}`);
  });

  // Wait for the ArcGIS map to have its view set up (check for the canvas)
  await page.waitForTimeout(6000);

  // Check what globals are defined
  const globals = await page.evaluate(() => {
    const diag = window.__STP_DIAG || {};
    return {
      StpSDK: typeof StpSDK,
      StpAS: typeof StpAS,
      ArcGisServerMap: typeof ArcGisServerMap,
      mapDiv: !!document.getElementById('map'),
      mapDivChildren: document.getElementById('map')?.children?.length ?? 0,
      diag_startCalled: diag.startCalled,
      diag_inkOnly: diag.inkOnly,
      diag_speechreco: diag.speechreco == null ? 'NULL' : typeof diag.speechreco,
      diag_mapInstance: diag.mapInstance == null ? 'NULL' : typeof diag.mapInstance,
      diag_mapOnStrokeStart: diag.mapInstance?.onStrokeStart == null ? 'NOT SET' : typeof diag.mapInstance.onStrokeStart,
      diag_error: diag.error,
    };
  });
  logs.push(`[GLOBALS] StpSDK=${globals.StpSDK}, StpAS=${globals.StpAS}, ArcGisServerMap=${globals.ArcGisServerMap}`);
  logs.push(`[MAP DIV] exists=${globals.mapDiv}, children=${globals.mapDivChildren}`);
  logs.push(`[DIAG] startCalled=${globals.diag_startCalled}, inkOnly=${globals.diag_inkOnly}`);
  logs.push(`[DIAG] speechreco=${globals.diag_speechreco}, mapInstance=${globals.diag_mapInstance}`);
  logs.push(`[DIAG] map.onStrokeStart=${globals.diag_mapOnStrokeStart}`);
  logs.push(`[DIAG] error=${globals.diag_error}`);

  // Simulate a pointer-down on the map area to test stroke start
  const mapEl = await page.$('#map');
  if (mapEl) {
    const box = await mapEl.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      logs.push(`[TEST] Simulating pointer-down at (${cx}, ${cy})`);
      await page.mouse.move(cx, cy);
      await page.mouse.down({ button: 'left' });
      await page.waitForTimeout(500);
      await page.mouse.up({ button: 'left' });
      await page.waitForTimeout(1000);
    } else {
      logs.push('[TEST] map element has no bounding box');
    }
  } else {
    logs.push('[TEST] #map element not found');
  }

  await page.waitForTimeout(2000);

  await browser.close();

  console.log('\n========== BROWSER REPORT ==========');
  if (logs.length === 0) {
    console.log('No console messages, errors, or network failures detected.');
  } else {
    logs.forEach(l => console.log(l));
  }
  console.log('====================================\n');
})();
