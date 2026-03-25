#!/usr/bin/env node
/**
 * tuPachanga – Store Asset Exporter
 * Convierte los HTML de marketing en PNG a la resolución exacta.
 *
 * Uso:  node export-screenshots.js
 *
 * Requisitos:
 *   npm install puppeteer   (solo la primera vez)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname);
const OUT = path.join(DIR, 'output');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const PAGES = [
  {
    file: 'screenshot-1-home.html',
    out:  'screenshot-1-home.png',
    w: 1080, h: 1920,
    desc: 'Pantalla Principal',
  },
  {
    file: 'screenshot-2-teams.html',
    out:  'screenshot-2-teams.png',
    w: 1080, h: 1920,
    desc: 'Equipos Equilibrados',
  },
  {
    file: 'screenshot-3-mvp.html',
    out:  'screenshot-3-mvp.png',
    w: 1080, h: 1920,
    desc: 'Votación MVP',
  },
  {
    file: 'screenshot-4-players.html',
    out:  'screenshot-4-players.png',
    w: 1080, h: 1920,
    desc: 'Listado de Jugadores',
  },
  {
    file: 'feature-graphic-1024x500.html',
    out:  'feature-graphic-1024x500.png',
    w: 1024, h: 500,
    desc: 'Feature Graphic (Play Store)',
  },
];

(async () => {
  console.log('\n🎨  tuPachanga – Store Asset Exporter\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const p of PAGES) {
    const url = `file://${path.join(DIR, p.file)}`;
    const outPath = path.join(OUT, p.out);

    const page = await browser.newPage();

    // Establecer resolución de pantalla exacta (deviceScaleFactor=2 para retina)
    await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 2 });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Esperar a que las fuentes Google carguen (si hay conexión)
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: p.w, height: p.h },
      omitBackground: false,
    });

    await page.close();
    console.log(`  ✅  ${p.desc.padEnd(30)} →  output/${p.out}`);
  }

  await browser.close();

  console.log('\n✨  Todas las imágenes generadas en:  store-assets/output/\n');
  console.log('📐  Dimensiones de cada archivo:');
  console.log('    • Screenshots (×4)  →  1080 × 1920 px  (9:16, Play Store / App Store)');
  console.log('    • Feature Graphic   →  1024 × 500 px   (Play Store banner)\n');
})();
