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

  // Метод для удаления элементов по тегу при загрузке страницы
  async removeElementsOnLoad(page, tags = ["noscript"]) {
    const selectorList = tags.map((tag) => `${tag}`).join(",");
    await page.evaluateOnNewDocument((selectorList) => {
      document.addEventListener("DOMContentLoaded", () => {
        const elements = document.querySelectorAll(selectorList);
        elements.forEach((el) => el.remove());
      });

      // Optional: удалить сразу, если DOM уже есть (для SSR страниц)
      const elements = document.querySelectorAll(selectorList);
      elements.forEach((el) => el.remove());
    }, selectorList);
  }
  // Отключение eval, atob
  async injectSecurityGuards(page) {
    await page.evaluateOnNewDocument(() => {
      // 🔒 Заблокировать eval
      const blockEval = () => {
        window.eval = () => {
          console.warn("Blocked: eval() is disabled");
          return undefined;
        };
        try {
          Object.defineProperty(window, "eval", {
            configurable: false,
            writable: false,
            value: () => {
              console.warn("Blocked: eval() is disabled");
              return undefined;
            },
          });
        } catch (e) {}
      };

      // 🔒 Заблокировать Function
      const blockFunctionConstructor = () => {
        window.Function = function () {
          console.warn("Blocked: Function constructor is disabled");
          return () => {};
        };
        try {
          Object.defineProperty(window, "Function", {
            configurable: false,
            writable: false,
            value: function () {
              console.warn("Blocked: Function constructor is disabled");
              return () => {};
            },
          });
        } catch (e) {}
      };

      // 🔒 Заблокировать atob
      const blockAtob = () => {
        window.atob = () => {
          console.warn("Blocked: atob() is disabled");
          return "";
        };
        try {
          Object.defineProperty(window, "atob", {
            configurable: false,
            writable: false,
            value: () => {
              console.warn("Blocked: atob() is disabled");
              return "";
            },
          });
        } catch (e) {}
      };

      blockEval();
      blockFunctionConstructor();
      blockAtob();
    });
  }
  // перехват и удаление узлов с определенными ключевыми словами
  async removeNodesWithKeywords(page, keywords = ["eval", "atob"]) {
    const pattern = new RegExp(keywords.join("|"), "i");

    await page.evaluateOnNewDocument((patternSource) => {
      const pattern = new RegExp(patternSource, "i");

      document.addEventListener("DOMContentLoaded", () => {
        const tagChecks = {
          script: (el) => pattern.test(el.textContent),
          iframe: (el) =>
            el.hasAttribute("srcdoc") &&
            pattern.test(el.getAttribute("srcdoc")),
          img: (el) => {
            const onerror = el.getAttribute("onerror");
            return onerror && pattern.test(onerror);
          },
          a: (el) => {
            const href = el.getAttribute("href");
            return href && href.startsWith("javascript:") && pattern.test(href);
          },
          "*": (el) => {
            const attrs = ["onclick", "onload", "onmouseover", "onmouseenter"];
            return attrs.some((attr) => {
              const val = el.getAttribute(attr);
              return val && pattern.test(val);
            });
          },
        };

        // Целевые теги для анализа
        const targetTags = ["script", "iframe", "img", "a"];

        targetTags.forEach((tag) => {
          document.querySelectorAll(tag).forEach((el) => {
            if (tagChecks[tag](el)) {
              console.warn(`🧹 Removed <${tag}> due to keyword match`);
              el.remove();
            }
          });
        });

        // Последний проход — проверка на общие JS-атрибуты (onclick, и т.п.)
        document.querySelectorAll("*").forEach((el) => {
          if (tagChecks["*"](el)) {
            console.warn("🧹 Removed node with suspicious inline JS");
            el.remove();
          }
        });
      });
    }, pattern.source);
  }
  //  для перехвата запросов
  async setupRequestInterception(page, context = {}) {
    const {
      images = [],
      stylesheets = [],
      fonts = [],
      blockedScriptKeywords = [],
      allowedDomain,
    } = context;

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const url = request.url();
      const type = request.resourceType();

      const isNav = request.isNavigationRequest();
      // 🛑 Блок редиректов за пределы домена
      if (isNav && allowedDomain) {
        const hostname = new URL(url).hostname;
        if (!hostname.includes(allowedDomain)) {
          console.warn("🚫 REDIRECT BLOCKED:", url);
          return request.abort();
        }
      }

      switch (type) {
        case "image":
          if (!images.includes(url)) images.push(url);
          request.abort();
          break;

        case "script":
          request.abort();
          // const shouldBlock = blockedScriptKeywords.some((keyword) =>
          //   url.includes(keyword)
          // );

          // if (shouldBlock) {
          //   console.log("🛑 BLOCKED SCRIPT:", url);
          //   request.abort();
          // } else {
          //   request.continue();
          // }
          break;

        case "stylesheet":
          if (!stylesheets.includes(url)) stylesheets.push(url);
          request.abort();
          break;

        case "font":
          if (!fonts.includes(url)) fonts.push(url);
          request.abort();
          break;

        case "other":
          const imageFormats = ["png", "jpg", "webp"];
          if (imageFormats.some((format) => url.includes(format))) {
            if (!images.includes(url)) images.push(url);
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
  }

  async createPage(P_LINK, duration = "30000") {
    try {
      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(duration);
      // ⛔️ Удаляем <noscript> (и опционально другие элементы)
      await this.removeElementsOnLoad(this.page, ["noscript"]);

      await this.removeNodesWithKeywords(this.page, ["eval", "atob"]);
      // 🔐 Защита от eval, Function, atob
      await this.injectSecurityGuards(this.page);
      // 🛑 Блокировка загрузки нежелательных ресурсов
      await this.setupRequestInterception(this.page, {
        images: this.images,
        stylesheets: this.stylesheets,
        fonts: this.fonts,
        blockedScriptKeywords: [
          "bean",
          "afrdtech.com",
          "kmnrKey",
          "clarity",
          "fbevents",
          "kmnr",
          "bean-script",
        ],
        allowedDomain: new URL(P_LINK).hostname,
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
