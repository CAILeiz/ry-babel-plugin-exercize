const macrosPlugin = require("babel-plugin-macros");
const { transformFileSync } = require("@babel/core");
const path = require("path");

const sourceFilePath = path.resolve(__dirname, "./sourceCode.js");

const { code } = transformFileSync(sourceFilePath, {
  plugins: [[macrosPlugin]],
});

console.log(code);
