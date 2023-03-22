const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const forDirectionLintPlugin = require("./plugin/for-direction-lint");

const fs = require("fs");
const path = require("path");

// 1. 读取源码
const sourceCode = fs.readFileSync(
  path.join(__dirname, `./source/${path.basename(__filename)}`),
  {
    encoding: "utf-8",
  }
);

const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
});

// 2. 插件遍历 ast
const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [forDirectionLintPlugin],
  filename: "input.js",
});

console.log(code);
