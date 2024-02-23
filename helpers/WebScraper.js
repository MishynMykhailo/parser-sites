const puppeteer = require("puppeteer");
require("colors");
require("dotenv").config();
const axios = require("axios");
const RequestError = require("../helpers/RequestError");
// Class that implements parsed site
// Добавить в консткрутор this.image и сюда через push добавлять images линки полученные при загрузке файлов в createPage
class WebScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.images = [];
    this.stylesheets = [];
    this.fonts = [];
  }
  // Method implement initiaalize browser for parser
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
  //  Method implement create page for parser
  async createPage(duration = "30000") {
    try {
      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(duration);
      await this.page.setRequestInterception(true);

      this.page.on("request", (request) => {
        const url = request.url();
        const type = request.resourceType(); // Тип ресурса (например, document, image, script и т.д.)
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
            }
            break;

          default:
            request.continue();
            // console.log(`Loaded resource: ${url}, Resource type: ${type}`);
            break;
        }
      });
    } catch (error) {
      new RequestError(500, `I can't create browser page:${error.message}`);
    }
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
      // console.log("Ошибка при подключении к прокси");
      new RequestError(401, `Unused login or password to the proxy`);
    }
  }
  //  Method implement naviagte on a page
  async gotoLink(P_LINK) {
    try {
      await this.page.goto(`${P_LINK}`);
    } catch (error) {
      new RequestError(500, "Pagination error, try again");
    }
  }
  //  Method implement parse full content in HTML
  async parseContent() {
    try {
      await this.page.waitForSelector("html", { visible: true });

      const smoothScroll = async () => {
        const maxHeight = document.body.scrollHeight;
        const duration = 1000;
        const increment = 20;

        for (let i = 0; i <= duration; i += increment) {
          const position = (maxHeight * i) / duration;
          window.scrollTo(0, position);
          await new Promise((resolve) => setTimeout(resolve, increment));
        }
      };

      // Вызываем плавную прокрутку
      await this.page.evaluate(smoothScroll);

      // Дождемся, пока скролл не завершится
      await this.page.waitForTimeout(1000); // Подождем еще 1 секунду (вы можете увеличить время ожидания, если необходимо)

      return await this.page.content();
    } catch (error) {
      console.error("Error in parsing:", error);
      throw new RequestError(500, "Error in parsing");
    }
  }

  // async searchFontsOnPage(createFile, P_LINK) {}

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
        console.log(`JS error,${error}`.red);
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
        console.log(`Link-ERROR${error}`.red);
      }
    }
    await this.gotoLink(P_LINK);
  }
  //  Method implement find img tags on a page
  async searchImageForPage(createFile, P_LINK) {
    // img tag for all images
    // const images = await this.page.$$eval("img", (e) => e.map((el) => el.src));
    for (let image of this.images) {
        console.log(image);

      try {
        const response = !image.includes("webp")
          ? await axios.get(image, {
              responseType: "arraybuffer",
            })
          : await axios.get(image, {
              responseType: "arrayBuffer",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
              },
              referrerPolicy: "strict-origin-when-cross-origin",
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
  //  Method implement closed broser after compliting all tasks
  async closeBrowser() {
    await this.browser.close();

    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = WebScraper;
