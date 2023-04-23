const WebScraper = require("./helpers/WebScraper.js");
const FileManager = require("./helpers/FileManager.js");
const PageModifier = require("./helpers/PageModifier.js");
require("dotenv").config();
const { P_LINK, PROX_SERVER, PROX_LOGIN, PROX_PASS } = process.env;

async function main() {
  // parsing site
  const scraper = new WebScraper();
  const fileManager = new FileManager();
  const pageModifier = new PageModifier();
  await scraper.initializeParser(PROX_SERVER, false);
  await scraper.createPage(120000);
  await scraper.authenticateProxy(PROX_LOGIN, PROX_PASS);
  await scraper.gotoLink(P_LINK);
  await scraper.parseContent();
  await fileManager.createFolders();
  await fileManager.createIndexHtml(await scraper.parseContent());
  await scraper.searchJsForPage(fileManager.createJsFile, P_LINK);
  await scraper.searchCssForPage(fileManager.createCssFile, P_LINK);
  await scraper.searchImageForPage(fileManager.createImageFile, P_LINK);
  await scraper.closeBrowser();
  // edit src
  await pageModifier.initializeModifier();
  await pageModifier.createPage(120000);
  await pageModifier.gotoLink();
  await pageModifier.clearPresetSettings();
  await pageModifier.editCssLink();
  await pageModifier.editJsScript();
  await pageModifier.editJqueryScript();
  await pageModifier.editImages();
  await pageModifier.clearLinkTag();
  await pageModifier.updateHtml();
  await pageModifier.closeBrowser();
}
main();
