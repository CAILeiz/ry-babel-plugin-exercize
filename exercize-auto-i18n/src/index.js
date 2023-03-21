const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const autoI18nPlugin = require("./plugin/auto-i18n-plugin");
const fs = require("fs");
const path = require("path");

// 1. 读取源码
const sourceCode = fs.readFileSync(path.join(__dirname, "./sourceCode.js"), {
  encoding: "utf-8",
});

// 2. 通过 parse.parse 将源码转成 ast
const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
  plugins: ["jsx"],
});

// 3. 通过 @babel/core 中的 transform 将 ast 通过插件转换中间代码
const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [
    [
      autoI18nPlugin,
      {
        outputDir: path.resolve(__dirname, "./output"), // 4. 配置输出目录
      },
    ],
  ],
});

console.log(code);
