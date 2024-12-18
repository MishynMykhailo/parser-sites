const puppeteer = require("puppeteer");
require("colors");
require("dotenv").config();
const fetch = require("node-fetch");
const axios = require("axios");
const RequestError = require("../helpers/RequestError");

class WebScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.images = [];
    this.stylesheets = [];
    this.fonts = [];
  }

  async initializeParser(PROX_SERVER, headless = "true") {
    this.browser = await puppeteer.launch({
      headless: headless,
      ignoreHTTPSErrors: true,
      request: "interception",
      args: [
        PROX_SERVER ? `--proxy-server=${PROX_SERVER}` : "",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }

  async createPage(duration = "30000") {
    try {
      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(duration);
      await this.page.setRequestInterception(true);

      this.page.on("request", (request) => {
        const url = request.url();
        const type = request.resourceType();
        switch (type) {
          case "image":
            if (!this.images.includes(url)) {
              this.images.push(url);
            }
            request.abort();
            break;
          case "stylesheet":
            if (!this.stylesheets.includes(url)) {
              this.stylesheets.push(url);
            }
            request.abort();
            break;
          case "font":
            if (!this.fonts.includes(url)) {
              this.fonts.push(url);
            }
            request.abort();
            break;
          case "other":
            const imageFormats = ["png", "jpg", "webp"];
            if (imageFormats.some((format) => url.includes(format))) {
              if (!this.images.includes(url)) {
                this.images.push(url);
              }
              request.abort();
            } else {
              request.continue();
            }
            break;
          default:
            request.continue();
            break;
        }
      });
    } catch (error) {
      throw new RequestError(
        500,
        `I can't create browser page:${error.message}`
      );
    }
  }

  async authenticateProxy(PROX_LOGIN, PROX_PASS) {
    if (!PROX_LOGIN || !PROX_PASS) {
      console.log("Вход без прокси".green);
      return;
    }
    try {
      await this.page.authenticate({
        username: `${PROX_LOGIN}`,
        password: `${PROX_PASS}`,
      });
      console.log("Подключение к прокси прошло успешно".brightGreen.bold);
    } catch (error) {
      throw new RequestError(401, `Unused login or password to the proxy`);
    }
  }

  async gotoLink(P_LINK) {
    try {
      // Ждем полной загрузки страницы
      await this.page.goto(`${P_LINK}`, { waitUntil: "networkidle2" });
    } catch (error) {
      throw new RequestError(500, "Pagination error, try again");
    }
  }

  async parseContent() {
    try {
      // Страница уже загружена при gotoLink с networkidle2
      await this.page.waitForSelector("html", { visible: true });

      // Плавная прокрутка до конца страницы
      await this.page.evaluate(async () => {
        const distance = 100;
        let totalHeight = 0;
        while (true) {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newTotalHeight = document.body.scrollHeight;
          if (newTotalHeight === scrollHeight) {
            break;
          }
          totalHeight = newTotalHeight;
        }
      });

      return await this.page.content();
    } catch (error) {
      console.error("Error in parsing:", error);
      throw new RequestError(500, "Error in parsing");
    }
  }

  async searchJsForPage(createFile, P_LINK) {
    const scripts = await this.page.$$eval("script", (elements) =>
      elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );
    for (let script of scripts) {
      try {
        const response = await axios.get(script, {
          responseType: "arraybuffer",
        });
        const data = response.data;
        const fileName = script.substring(
          script.lastIndexOf("/") + 1,
          script.lastIndexOf(".js") + 3
        );

        await createFile(fileName, data);
      } catch (error) {
        console.log(`JS error,${error}`.red);
      }
    }
    await this.gotoLink(P_LINK);
  }

  async searchCssForPage(createFile, P_LINK) {
    const linkCss = await this.page.$$eval("link", (elements) =>
      elements.map((el) => el.href).filter((e) => e.includes(".css"))
    );
    for (let link of linkCss) {
      try {
        const response = await this.page.goto(link, {
          waitUntil: "networkidle2",
        });
        const data = await response.buffer();

        let fileName = link.substring(
          link.lastIndexOf("/") + 1,
          link.lastIndexOf(".css") + 4
        );
        await createFile(fileName, data);
      } catch (error) {
        console.log(`Link-ERROR${error}`.red);
      }
    }
    await this.gotoLink(P_LINK);
  }

  async searchImageForPage(createFile, P_LINK) {
    for (let image of this.images) {
      console.log(image);
      try {
        if (!image.includes("webp")) {
          const response = await axios.get(image, {
            responseType: "arraybuffer",
          });
          const data = response.data;
          const fileName = image.substring(image.lastIndexOf("/") + 1);
          await createFile(fileName, data);
        } else {
          const response = await fetch(image);
          const data = await response.buffer();
          console.log(data);
          const fileName = image.substring(image.lastIndexOf("/") + 1);
          await createFile(fileName, data);
        }
      } catch (err) {
        console.log("Произошла ошибка при загрузке изображения", err.message);
        continue;
      }
    }

    await this.gotoLink(P_LINK);

    const sources = await this.page.$$eval("source", (e) =>
      e.map((el) => el.srcset.split(" ")[0].replace("./", ""))
    );
    for (let source of sources) {
      try {
        const response = await axios.get(this.page.url() + source, {
          responseType: "arraybuffer",
        });
        const data = response.data;
        const fileName = source.substring(source.lastIndexOf("/") + 1);
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
