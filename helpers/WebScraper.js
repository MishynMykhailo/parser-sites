const puppeteer = require("puppeteer");
require("colors");
require("dotenv").config();
const axios = require("axios");
// Class that implements parsed site
class WebScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }
  // Method implement initiaalize browser for parser
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
  //  Method implement create page for parser
  async createPage(duration = "30000") {
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(duration);
  }
  //  Method implement authenticate proxy for parser, if any PROX_LOGIN and PROX_PASS
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
      console.log("Ошибка при подключении к прокси", err.message);
    }
  }
  //  Method implement naviagte on a page
  async gotoLink(P_LINK) {
    await this.page.goto(`${P_LINK}`);
  }
  //  Method implement parse full content in HTML
  async parseContent() {
    await this.page.waitForSelector("html", { visible: true });
    await this.page.evaluate(() => {
      window.scrollBy(0, 2000);
    });
    return await this.page.content();
  }
  // //  Method implement find js scripts on a page
  // async searchJsForPage(createFile, P_LINK) {
  //   const scripts = await this.page.$$eval("script", (elements) =>
  //     elements.map((el) => el.src).filter((e) => e.includes(".js"))
  //   );
  //   for (let script of scripts) {
  //     try {
  //       const response = await this.page.goto(script);
  //       const data = await response.buffer();
  //       const fileName = script.substring(
  //         script.lastIndexOf("/") + 1,
  //         script.lastIndexOf(".js") + 3
  //       );
  //       await createFile(fileName, data);
  //     } catch (error) {
  //       console.log(`error,${error}`.red);
  //     }
  //   }
  //   await this.gotoLink(P_LINK);
  // }
  async searchJsForPage(createFile, P_LINK) {
    const scripts = await this.page.$$eval("script", (elements) =>
      elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );
    for (let script of scripts) {
      try {
        const response = await axios.get(script, {
          responseType: "arraybuffer",
        });
        const data = await response.data;
        const fileName = script.substring(
          script.lastIndexOf("/") + 1,
          script.lastIndexOf(".js") + 3
        );
        await createFile(fileName, data);
      } catch (error) {
        console.log(`error,${error}`.red);
        console.log(script);
      }
    }
    await this.gotoLink(P_LINK);
  }
  //  Method implement find css links on a page
  async searchCssForPage(createFile, P_LINK) {
    const linkCss = await this.page.$$eval("link", (elements) =>
      elements.map((el) => el.href).filter((e) => e.includes(".css"))
    );
    for (let link of linkCss) {
      try {
        const response = await this.page.goto(link);
        const data = await response.buffer();

        let fileName = link.substring(
          link.lastIndexOf("/") + 1,
          link.lastIndexOf(".css") + 4
        );
        await createFile(fileName, data);
      } catch (error) {
        console.log(`error,${error}`.red);
        console.log(link);
      }
    }
    await this.gotoLink(P_LINK);
  }
  //  Method implement find img tags on a page
  async searchImageForPage(createFile, P_LINK) {
    // img tag for all images
    const images = await this.page.$$eval("img", (e) => e.map((el) => el.src));
    for (let image of images) {
      try {
        const response = await axios.get(image, {
          responseType: "arraybuffer",
        });
        const data = response.data;

        const fileName = image.substring(image.lastIndexOf("/") + 1);
        await createFile(fileName, data);
      } catch (err) {
        console.log("Произошла ошибка при загрузке изображения", err.message);
        continue;
      }
    }

    await this.gotoLink(P_LINK);

    // source tag for Webp images
    const sources = await this.page.$$eval("source", (e) =>
      e.map((el) => {
        return el.srcset.split(" ")[0].replace("./", "");
      })
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
        console.log(this.page.url() + source);
        console.log("Произошла ошибка при загрузке изображения", err.message);
        continue;
      }
    }

    await this.gotoLink(P_LINK);
  }
  //  Method implement closed broser after compliting all tasks
  async closeBrowser() {
    await this.browser.close();

    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = WebScraper;
