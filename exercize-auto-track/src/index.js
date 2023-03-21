const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const autoTrackPlugin = require("./plugin/auto-track-plugin");
const fs = require("fs");
const path = require("path");

// 1. 读取 sourceCode 文件源码
const sourceCode = fs.readFileSync(path.join(__dirname, "./sourceCode.js"), {
  encoding: "utf-8",
});

// 2. 使用 parse.parse 将 sourceCode 转成 ast
const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
});

// 3. ast 生成 code
// deadPoint1
const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [
    [
      autoTrackPlugin, // 2. 注册需求
      {
        trackerPath: "tracker",
      },
    ],
  ],
});

console.log(code);
