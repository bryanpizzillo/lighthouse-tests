import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';
import { URL } from 'url';
import csv from 'csv-parser';
import desktopConfig from 'lighthouse/core/config/lr-desktop-config.js';
import mobileConfig from 'lighthouse/core/config/lr-mobile-config.js';

async function runLighthouse(url, config) {
  const browser = await puppeteer.launch({ headless: true });
  const { lhr } = await lighthouse(
    url, 
    {
      port: (new URL(browser.wsEndpoint())).port,
    }, 
    config
  );

  await browser.close();
  return lhr;
}

async function auditUrls(urls) {
  for (const url of urls) {
    try {
      const desktopResult = await runLighthouse(url, desktopConfig);
      const mobileResult = await runLighthouse(url, mobileConfig);

      const baseFileName = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      if (!existsSync('./results')) {
        mkdirSync('./results');
      }

      writeFileSync(`./results/${baseFileName}_desktop.json`, JSON.stringify(desktopResult, null, 2));
      writeFileSync(`./results/${baseFileName}_mobile.json`, JSON.stringify(mobileResult, null, 2));

      console.log(`Successfully saved desktop and mobile audits for ${url}`);
    } catch (error) {
      console.error(`Error auditing ${url}:`, error);
    }
  }
}

function readUrlsFromCsv(filePath) {
  return new Promise((resolve, reject) => {
    const urls = [];
    createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        const url = Object.values(row)[0]?.trim(); // Get the first value of each row
        urls.push(!url.startsWith('https://') ? `https://${url}` : url);
      })
      .on('end', () => {
        resolve(urls);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function main() {
  const csvFilePath = process.argv[2];
  if (!csvFilePath) {
    console.error('Please provide a path to the CSV file as a command-line argument.');
    process.exit(1);
  }

  try {
    // Remove the results directory if it exists
    if (existsSync('./results')) {
      rmSync('./results', { recursive: true, force: true });
    }

    // Recreate the results directory
    mkdirSync('./results');

    const urls = await readUrlsFromCsv(csvFilePath);
    await auditUrls(urls);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
