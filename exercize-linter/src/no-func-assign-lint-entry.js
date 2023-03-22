const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const noFuncAssignLintPlugin = require("./plugin/no-func-assign-lint");
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

const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [noFuncAssignLintPlugin],
  filename: "input.js",
});

console.log(code);
