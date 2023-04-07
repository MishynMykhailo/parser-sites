const fs = require("fs/promises");
class FileManager {
  constructor() {}
  // Сделать функцию которая будет проверять на наличие папки по указаному пути checkIfDirectoryExists;
  async checkIfDirectoryExists(path) {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch (err) {
      if (err.code === "ENOENT") {
        return false;
      } else {
        throw err;
      }
    }
  }

  async createSrcFolder() {
    try {
      await fs.mkdir("src");
      console.log("Папка 'src' успешно создана!".green);
    } catch (err) {
      console.log("Папка 'src' уже существует!".yellow);
    }
  }

  async createCssFolder() {
    try {
      await fs.mkdir("./src/css");
      console.log("Папка 'css' успешно создана!".green);
    } catch (err) {
      console.log("Папка 'css' уже существует!".yellow);
    }
  }

  async createJsFolder() {
    try {
      await fs.mkdir("./src/js");
      console.log("Папка 'js' успешно создана!".green);
    } catch (err) {
      console.log("Папка 'js' уже существует!".yellow);
    }
  }

  async createImagesFolder() {
    try {
      await fs.mkdir("./src/images");
      console.log("Папка 'images' успешно создана!".green);
    } catch (err) {
      console.log("Папка 'images' уже существует!".yellow);
    }
  }

  async createIndexHtml(htmlContent) {
    try {
      await fs.writeFile("./src/index.html", htmlContent);
      console.log("Файл 'index.html' успешно создан!".green);
    } catch (err) {
      console.log(err.message.red);
    }
  }
  async createJsFile(fileName, data) {
    try {
      await fs.writeFile(`./src/js/${fileName}`, data);
      console.log("Файл 'js' успешно созданы".green);
    } catch (err) {
      console.log(err.message.red);
    }
  }
  async createCssFile(fileName, data) {
    try {
      await fs.writeFile(`./src/css/${fileName}`, data);
      console.log("Файл 'css' успешно созданы".green);
    } catch (err) {
      console.log(err.red);
    }
  }
  async createImageFile(fileName, data) {
    try {
      await fs.writeFile(`./src/images/${fileName}`, data);
      console.log("Файл 'images' успешно созданы".green);
    } catch (err) {
      console.log(err.red);
    }
  }
}
module.exports = FileManager;
