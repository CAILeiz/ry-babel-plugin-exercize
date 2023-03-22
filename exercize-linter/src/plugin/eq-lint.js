const { declare } = require("@babel/helper-plugin-utils");

const forDirectionLint = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    pre(file) {
      file.set("errors", []);
    },
    visitor: {
      // 1. 匹配二元表达式 xx = yy
      BinaryExpression(path, state) {
        const errors = state.file.get("errors");
        // 2. 匹配 "==", "!=" 如果两端都不是字面量或者类型不同, 抛出错误
        if (["==", "!="].includes(path.node.operator)) {
          const left = path.get("left");
          const right = path.get("right");
          const leftIsLiteral = left.isLiteral();
          const rightIsLiteral = right.isLiteral();
          const leftVal = left.node.value;
          const rightVal = right.node.value;
          const typLeftVal = typeof leftVal;
          const typRightVal = typeof rightVal;
          if (
            !(leftIsLiteral && rightIsLiteral && typLeftVal === typRightVal)
          ) {
            const tmp = Error.stackTraceLimit;
            Error.stackTraceLimit = 0; // 3. 过滤 多行错误
            errors.push(
              path.buildCodeFrameError(
                `please replace ${path.node.operator} with ${
                  path.node.operator + "="
                }`,
                Error
              )
            );
            Error.stackTraceLimit = tmp;
            // 4. 配置项中有 fix 属性, 直接在操作符后面增加 '='
            if (state.opts.fix) {
              path.node.operator = path.node.operator + "=";
            }
          }
        }
      },
    },
    post(file) {
      console.log(file.get("errors"));
    },
  };
});

module.exports = forDirectionLint;
