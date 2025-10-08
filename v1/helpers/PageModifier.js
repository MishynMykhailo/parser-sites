const puppeteer = require("puppeteer");
const path = require("path");
const url = require("url");

const fs = require("fs/promises");
require("dotenv").config();
require("colors");

// Class that implements refactoring of a parsed site
class PageModifier {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pathDir = url.pathToFileURL(
      path.resolve(__dirname, "../src/index.html")
    ).href;
  }
  // Method implement initializes pupetter browser
  async initializeModifier(headless = "true") {
    this.browser = await puppeteer.launch({
      headless: headless,
      ignoreHTTPSErrors: true,
    });
  }
  //  Method implement create page for parser
  async createPage(duration = 30000) {
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(duration);
  }
  //  Method implement naviagte on a page
  async gotoLink(direction = this.pathDir) {
    await this.page.goto(direction, { waitUntil: "networkidle2" });
    await this.page.waitForSelector("html", { visible: true });
  }
  // Method implement delete preset settings, for example <base>
  async clearPresetSettings() {
    const baseRemoved = await this.page.evaluate(() => {
      const removeBase = document.querySelector("base");
      if (removeBase) {
        removeBase.remove();
        return true;
      }
      return false;
    });
    if (baseRemoved) {
      console.log("Тег <base> удален".green);
    }
  }
  // add indvidual tag for div tags
  async addIndividualTag(nameTag) {
    await this.page.$$eval(
      "div",
      (elements, tag) => {
        elements.forEach((e, index) => {
          if (!e.classList.contains(tag) && !e.getAttribute("data-info")) {
            e.classList.add(`${tag}-${index}`);
            e.setAttribute("data-info", `${tag}-${index}`);
          }
        });
      },
      nameTag
    );
    console.log(`Добвлена метка ${nameTag}`.green);
  }
  // Method implement edit css link in html file
  async editCssLink() {
    await this.page.$$eval("link", (elements) => {
      elements.forEach((el) => {
        if (el.hasAttribute("rel")) {
          const rel = el.getAttribute("rel");
          const href = el.getAttribute("href") || "";
          if (rel === "icon") {
            el.setAttribute(
              "href",
              `./images/${href.substring(href.lastIndexOf("/") + 1)}`
            );
          } else if (rel === "stylesheet" && href.includes(".css")) {
            el.setAttribute(
              "href",
              `./css/${href.substring(href.lastIndexOf("/") + 1)}`
            );
          }
        }
      });
    });
    console.log(
      "в теге <link> поменян путь на './css/...', для иконок - './images/...'"
        .green
    );
  }
  // Method implement edit js script in html file
  async editJsScript() {
    // Находим скрипты один раз
    const scripts = await this.page.$$eval("script", (elements) =>
      elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );

    // Удаляем все скрипты с атрибутом src
    await this.page.$$eval("script", (elements) => {
      elements.forEach((el) => {
        if (el.hasAttribute("src")) el.remove();
      });
    });
    console.log("Тег <script> почищен".green);

    // Считываем локальные файлы из ./src/js
    let files = [];
    try {
      files = await fs.readdir("./src/js");
    } catch (err) {
      console.log(`Ошибка при чтении директории js: ${err.message}`.red);
    }

    // Добавляем все локальные скрипты
    for (const file of files) {
      try {
        await this.page.$eval(
          "body",
          (body, file) => {
            const linkScript = document.createElement("script");
            linkScript.setAttribute("type", "text/javascript");
            linkScript.setAttribute("src", `./js/${file}`);
            body.appendChild(linkScript);
          },
          file
        );
      } catch (err) {
        console.log(
          `Ошибка при добавлении скрипта ${file}: ${err.message}`.red
        );
      }
    }

    console.log("Тег <script> из существующих файлов js добавлен в body".green);
  }

  // Method implement edit or add jquery script in html file
  async editJqueryScript() {
    const linkJquery =
      "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";

    // Проверяем, есть ли уже jQuery
    const isJqueryPresent = await this.page.evaluate((url) => {
      return !!document.querySelector(`script[src="${url}"]`);
    }, linkJquery);

    if (isJqueryPresent) {
      console.log("Уже есть JQuery".yellow);
      return;
    }

    // Если jQuery нет, добавляем
    await this.page.evaluate((url) => {
      const head = document.querySelector("head");
      if (!head) return;
      const script = document.createElement("script");
      script.src = url;
      head.appendChild(script);
    }, linkJquery);

    console.log("JQuery установлен в head".green);
  }

  // Method implement edit the tag "a" clearing the href attribute
  async clearLinkTag() {
    await this.page.$$eval("a", (elements) => {
      elements.forEach((el) => {
        el.href = "#";
        if (el.hasAttribute("onclick")) el.removeAttribute("onclick");
        if (el.hasAttribute("target")) el.removeAttribute("target");
        if (el.hasAttribute("data-elementdataevent")) {
          el.removeAttribute("data-elementdataevent");
        }
        if (el.hasAttribute("elementdataevent")) {
          el.removeAttribute("elementdataevent");
        }
      });
    });
    console.log("Тег <a> почищен ".green);
  }

  // Method wrap img tag in a tag
  async wrapImage() {
    await this.page.$$eval("img", (elements) => {
      elements.forEach((item) => {
        const createTagA = document.createElement("a");
        createTagA.setAttribute("href", "#");
        createTagA.appendChild(item.cloneNode(true));
        item.replaceWith(createTagA);
      });
    });
  }

  // Method implement edit img to specify the required path
  async editImages() {
    await this.page.$$eval("img", (elements) => {
      elements.forEach((el) => {
        el.setAttribute(
          "src",
          `./images/${el.src.substring(el.src.lastIndexOf("/") + 1)}`
        );
        if (!el.hasAttribute("loading")) {
          el.setAttribute("loading", "lazy");
        }
      });
    });

    await this.page.$$eval("source", (elements) => {
      elements.forEach((el) => {
        el.setAttribute(
          "srcset",
          `./images/${el.srcset.substring(el.srcset.lastIndexOf("/") + 1)}`
        );
      });
    });

    console.log("в теге <img> и <source> поменян путь на './images/...'".green);
  }

  async editCss() {
    await this.page.evaluate(() => {
      const styleTags = document.querySelectorAll("style");
      styleTags.forEach((styleTag) => {
        const updatedStyleContent = styleTag.innerHTML.replace(
          /background-image:\s*url\(img\//g,
          "background-image: url(images/"
        );
        styleTag.innerHTML = updatedStyleContent;
      });
    });
  }

  async editCssProperty() {
    const files = await fs.readdir("./src/css");
    for (let file of files) {
      const cssFilePath = path.join(__dirname, "../src/css", file);
      const cssContent = await fs.readFile(cssFilePath, "utf8");

      const updatedContent = cssContent.replace(
        /background-image:\s*url\(\.\.\/img\//g,
        "background-image: url(../images/"
      );

      await fs.writeFile(cssFilePath, updatedContent, "utf8");
    }
    console.log("Файл css обновлен background-image.".green);
  }

  // Method implement after all edit , it function update our html
  async updateHtml() {
    console.log("update");

    const htmlContent = await this.page.content();
    try {
      await fs.writeFile("./src/index.html", htmlContent, "utf8");
      console.log("HTML файл обновлен".green);
    } catch (err) {
      console.log(err);
    }
  }
  // Method implement finally the script and close the browser
  async closeBrowser() {
    await this.browser.close();
    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = PageModifier;
