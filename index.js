const WebScraper = require("./helpers/WebScraper.js");
const FileManager = require("./helpers/FileManager.js");
const PageModifier = require("./helpers/PageModifier.js");
require("dotenv").config();
const { P_LINK, PROX_SERVER, PROX_LOGIN, PROX_PASS } = process.env;

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main(deleteAnswer) {
  // parsing site
  const scraper = new WebScraper();
  const fileManager = new FileManager();
  const pageModifier = new PageModifier();
  await fileManager.deleteSrcFolder(deleteAnswer);
  // await scraper.initializeParser(PROX_SERVER, false);
  // await scraper.createPage(120000);
  // await scraper.authenticateProxy(PROX_LOGIN, PROX_PASS);
  // await scraper.gotoLink(P_LINK);
  // await scraper.parseContent();
  // await fileManager.createFolders();
  // await fileManager.createIndexHtml(await scraper.parseContent());
  // await scraper.searchJsForPage(fileManager.createJsFile, P_LINK);
  // await scraper.searchCssForPage(fileManager.createCssFile, P_LINK);
  // await scraper.searchImageForPage(fileManager.createImageFile, P_LINK);
  // await scraper.closeBrowser();
  // // // // edit src
  await pageModifier.initializeModifier(false);
  await pageModifier.createPage(120000);
  await pageModifier.gotoLink();
  await pageModifier.clearPresetSettings();
  await pageModifier.addIndividualTag("bigbanana");
  // await pageModifier.editCssLink();
  // await pageModifier.editJsScript();
  // await pageModifier.editJqueryScript();
  // await pageModifier.editImages();
  // await pageModifier.clearLinkTag();
  // await pageModifier.editCss();
  // await pageModifier.editCssProperty();
  await pageModifier.updateHtml();
  await pageModifier.closeBrowser();
}
readline.question(
  "Do you want to delete the 'src' folder? (y/n) ",
  (answer) => {
    if (answer.toLowerCase() === "y") {
      main(true);
    } else if (answer.toLowerCase() === "n") {
      main(false);
    } else {
      console.log("Invalid input. Please enter 'y' or 'n'.");
      readline.close();
    }
  }
);
