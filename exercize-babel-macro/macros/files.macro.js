const { createMacro } = require("babel-plugin-macros");
const path = require("path");
const fs = require("fs");

function logMacro({ references, state, babel }) {
  const { default: referredPaths = [] } = references;
  // 1. referredPaths: 所有引用 macro 的节点路径
  referredPaths.forEach((referredPath) => {
    // 2. 根据文件路径跟当前路径操作符获取真实路径
    const dirPath = path.join(
      path.dirname(state.filename), // 当前执行文件的路径 files 函数中的第一个参数,如 '../src'
      referredPath.parentPath.get("arguments.0").node.value // 获取
    );
    // 3. 根据最终路径读取目录下文件, 是一个[]
    const fileNames = fs.readdirSync(dirPath);
    // 4. 生成数组表达式
    const ast = babel.types.arrayExpression(
      fileNames.map((fileName) => babel.types.stringLiteral(fileName))
    );
    // 5. 替换节点
    referredPath.parentPath.replaceWith(ast);
  });
}

module.exports = createMacro(logMacro);
