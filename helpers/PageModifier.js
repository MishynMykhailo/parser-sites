const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs/promises");
require("dotenv").config();
require("colors");

// Class that implements refactoring of a parsed site
class PageModifier {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pathDir = path.resolve("file:///", __dirname, "../src/index.html");
  }
  // Method implement initializes pupetter browser
  async initializeModifier(PROX_SERVER, headless = "true") {
    this.browser = await puppeteer.launch({
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: false,
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
    await this.page.goto(direction);
    await this.page.waitForSelector("html", { visible: true });
  }
  // Method implement delete preset settings, for example <base>
  async clearPresetSettings() {
    await this.page.evaluate(async () => {
      const removeBase = document.querySelector("base");
      if (removeBase) {
        removeBase.remove();
        console.log("Тег <base> удален".green);
      }
    });
  }
  // Method implement edit css link in html file
  async editCssLink() {
    const linksCss = await this.page.$$eval("link", (elements) =>
      elements.map((el) => el.href).filter((e) => e.includes(".css"))
    );
    for (let i = 0; i < linksCss.length; i += 1) {
      try {
        await this.page.$$eval("link", (elements) => {
          elements.forEach((el) => {
            if (el.hasAttribute("rel") && el.getAttribute("rel") === "icon") {
              return el.setAttribute(
                "href",
                `./images/${el.href.substring(el.href.lastIndexOf("/") + 1)}`
              );
            }
            el.setAttribute(
              "href",
              `./css/${el.href.substring(el.href.lastIndexOf("/") + 1)}`
            );
          });
        });
      } catch (err) {
        console.log(err);
      }
    }
    console.log("в теге <link> поменян путь на './css/...'".green);
  }
  // Method implement edit js script in html file
  async editJsScript() {
    const scripts = await this.page.$$eval("script", (elements) =>
      elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );
    for (let i = 0; i < scripts.length; i += 1) {
      try {
        const files = await fs.readdir("./src/js");
        await this.page.$$eval("script", (elements) => {
          console.log(elements);
          elements.forEach((el) => {
            if (el.hasAttribute("src")) el.remove();
          });
        });
      } catch (err) {
        console.log(err);
      }
      console.log("Тег <script> почищен".green);
    }
    const files = await fs.readdir("./src/js");
    try {
      for (const file of files) {
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
      }
    } catch (err) {
      console.log(err);
    }
    console.log("Тег <script> из существующих файлов js добавлен в body".green);
  }
  // Method implement edit or add jquery script in html file
  async editJqueryScript() {
    await this.page.$eval("head", (head) => {
      const linkJquery =
        "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";
      if (document.querySelector(`script[src="${linkJquery}"]`)) {
        console.log("Уже есть JQuery".yellow);
        return;
      } else {
        const script = document.createElement("script"); // исправлено
        script.setAttribute(
          "src",
          "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"
        );
        head.appendChild(script);
      }
    });
    console.log("JQuery установлен в head".green);
  }
  // Method implement edit the tag "a" clearing the href attribute
  async clearLinkTag() {
    await this.page.$$eval("a", (e) =>
      e.map((el) => {
        el.href = "#";
        if (el.hasAttribute("onclick")) el.removeAttribute("onclick");
        if (el.hasAttribute("target")) el.removeAttribute("target");
      })
    );
  }
  // Method implement edit img to specify the required path
  async editImages() {
    const images = await this.page.$$eval("img", (e) => e.map((el) => el.src));
    for (let i = 0; i < images.length; i += 1) {
      try {
        const files = await fs.readdir("./src/images");
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
      } catch (err) {
        console.log(err);
      }
    }
    console.log("в теге <img> поменян путь на './images/...'".green);
  }
  async editCss() {
    const styles = await this.page.evaluate(() => {
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
    await fs.writeFile("./src/index.html", htmlContent, function (err) {
      if (err) {
        throw err;
      }
      console.log("HTML файл обновлен".green);
    });
  }
  // Method implement finally the script and close the browser
  async closeBrowser() {
    await this.browser.close();

    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = PageModifier;
