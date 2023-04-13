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
  // Fuction that initializes pupetter browser
  async initializeModifier(PROX_SERVER, headless = "true") {
    this.browser = await puppeteer.launch({
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: false,
      ignoreHTTPSErrors: true,
    });
  }
  // Create new page in browser
  async createPage() {
    this.page = await this.browser.newPage();
  }
  // Navigate for link
  async gotoLink() {
    console.log(this.pathDir);
    await this.page.goto(this.pathDir);
    await this.page.waitForSelector("html", { visible: true });
  }
  // Delete preset settings, for example <base>
  async clearPresetSettings() {
    await this.page.evaluate(async () => {
      const removeBase = document.querySelector("base");
      if (removeBase) {
        removeBase.remove();
      }
    });
  }
  // Edit css link in html file
  async editCssLink() {
    const linksCss = await this.page.$$eval("link", (elements) =>
      elements.map((el) => el.href).filter((e) => e.includes(".css"))
    );
    for (let i = 0; i < linksCss.length; i += 1) {
      try {
        await this.page.$$eval("link", (elements) => {
          elements.forEach((el) => {
            if (el.href !== null) el.remove();
          });
        });
      } catch (err) {
        console.log(err);
      }
    }
    const files = await fs.readdir("./src/css");
    try {
      for (const file of files) {
        await this.page.$eval(
          "head",
          (head, file) => {
            const linkCss = document.createElement("link");
            linkCss.setAttribute("rel", "stylesheet");
            linkCss.setAttribute("href", `./css/${file}`);
            head.appendChild(linkCss);
          },
          file
        );
      }
    } catch (err) {
      console.log(err);
    }
  }
  // Edit js script in html file
  async editJsScript() {
    const scripts = await this.page.$$eval("script", (elements) =>
      elements.map((el) => el.src).filter((e) => e.includes(".js"))
    );
    for (let i = 0; i < scripts.length; i += 1) {
      try {
        const files = await fs.readdir("./src/js");
        await this.page.$$eval("script", (elements) => {
          elements.forEach((el) => {
            if (el.src !== null) el.remove();
          });
        });
      } catch (err) {
        console.log(err);
      }
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
  }
  // Edit or add jquery script in html file
  async editJqueryScript() {
    await this.page.$eval("head", (head) => {
      const linkJquery =
        "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";
      if (document.querySelector(`script[src="${linkJquery}"]`)) {
        console.log("Уже есть jquery");
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
  }
  // edit the tag "a" clearing the href attribute
  async clearLinkTag() {
    await this.page.$$eval("a", (e) => e.map((el) => el.href == "#"));
  }
  //edit img to specify the required path
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
          });
        });
      } catch (err) {
        console.log(err);
      }
    }
  }
  // after all edit , it function update our html
  async updateHtml() {
    console.log("update");

    const htmlContent = await this.page.content();
    await fs.writeFile("./src/index.html", htmlContent, function (err) {
      if (err) {
        throw err;
      }
      console.log("File created");
    });
  }
  // finally the script and close the browser
  async closeBrowser() {
    await this.browser.close();

    console.log("Работа завершена".brightGreen.bold);
  }
}
module.exports = PageModifier;
