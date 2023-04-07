const puppeteer = require("puppeteer");
require("colors");
require("dotenv").config();
const { P_LINK, PROX_SERVER, PROX_LOGIN, PROX_PASS } = process.env;

class WebScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }
  async initializeParser(PROX_SERVER, headless = "true") {
    this.browser = await puppeteer.launch({
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: headless,
      ignoreHTTPSErrors: true,
      args: [
        PROX_SERVER ? `--proxy-server=${PROX_SERVER}` : "",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }

  async createPage() {
    this.page = await this.browser.newPage();
  }

  async authenticateProxy(PROX_LOGIN, PROX_PASS) {
    if (!PROX_LOGIN || !PROX_PASS) {
      console.log("hi");
      return;
    }
    try {
      await this.page.authenticate({
        username: `${PROX_LOGIN}`,
        password: `${PROX_PASS}`,
      });
      console.log("Подключение к прокси прошло успешно".brightGreen.bold);
    } catch (error) {
      console.log("Ошибка при подключении к прокси", err.message);
    }
  }

  async gotoLink(P_LINK) {
    await this.page.goto(`${P_LINK}`);
  }

  async parseContent() {
    await this.page.waitForSelector("html", { visible: true });
    return await this.page.content();
  }

  async searchJsForPage(createFile, P_LINK) {
    const scripts = await this.page.$$eval(
      'script[type="text/javascript"]',
      (elements) =>
        elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );
    for (let script of scripts) {
      const response = await this.page.goto(script);
      const data = await response.buffer();
      const fileName = script.substring(
        script.lastIndexOf("/") + 1,
        script.lastIndexOf(".js") + 3
      );
      await createFile(fileName, data);
    }
    await this.gotoLink(P_LINK);
  }

  async searchCssForPage(createFile, P_LINK) {
    const linkCss = await this.page.$$eval(
      'link[rel="stylesheet"]',
      (elements) =>
        elements.map((el) => el.href).filter((e) => e.includes(".css"))
    );
    for (let link of linkCss) {
      const response = await this.page.goto(link);
      const data = await response.buffer();

      let fileName = link.substring(
        link.lastIndexOf("/") + 1,
        link.lastIndexOf(".css") + 4
      );
      await createFile(fileName, data);
    }
    await this.gotoLink(P_LINK);
  }

  async searchImageForPage(createFile, P_LINK) {
    const images = await this.page.$$eval("img", (e) => e.map((el) => el.src));
    for (let image of images) {
      try {
        const response = await this.page.goto(image);
        const data = await response.buffer();
        const fileName = image.substring(image.lastIndexOf("/") + 1);
        await createFile(fileName, data);
      } catch (err) {
        console.log("Произошла ошибка при загрузке изображения", err.message);
        continue;
      }
    }
    await this.gotoLink(P_LINK);
  }

  async closeBrowser() {
    await this.browser.close();

    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = WebScraper;

