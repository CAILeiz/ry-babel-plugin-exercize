const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const eqLintPlugin = require("./plugin/eq-lint");
const fs = require("fs");
const path = require("path");

// 1. 读取源码
const sourceCode = fs.readFileSync(
  path.join(__dirname, `./source/${path.basename(__filename)}`),
  {
    encoding: "utf-8",
  }
);

// 2. parse 源码 -> ast
const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
  comments: true,
});

// 3. 通过插件遍历 ast
const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [
    [
      eqLintPlugin,
      {
        fix: true, // 是否自动修复代码
      },
    ],
  ],
  comments: true,
});

console.log(code);
