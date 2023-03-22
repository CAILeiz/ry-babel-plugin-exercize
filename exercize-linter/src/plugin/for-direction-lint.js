const { declare } = require("@babel/helper-plugin-utils");

const forDirectionLint = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    pre(file) {
      file.set("errors", []);
    },
    visitor: {
      // 1. 通过 ForStatement 来匹配 for循环
      // 判断for循环中间操作符跟最后操作符是否是匹配的
      ForStatement(path, state) {
        const errors = state.file.get("errors");
        // 2. 找到 for循环中间的操作符, 如 > >= < <=
        const testOperator = path.node.test.operator;
        const udpateOperator = path.node.update.operator;

        // 3. 定义更新应该的操作符
        let sholdUpdateOperator;
        if (["<", "<="].includes(testOperator)) {
          sholdUpdateOperator = "++";
        } else if ([">", ">="].includes(testOperator)) {
          sholdUpdateOperator = "--";
        }

        // 4. 操作符不匹配记录错误信息
        if (sholdUpdateOperator !== udpateOperator) {
          const tmp = Error.stackTraceLimit;
          Error.stackTraceLimit = 0;
          errors.push(
            path.get("update").buildCodeFrameError("for direction error", Error)
          );
          Error.stackTraceLimit = tmp;
        }
      },
    },
    // 5. 打印错误信息, state.file['_map'].errors
    post(file) {
      console.log(file.get("errors"));
    },
  };
});

module.exports = forDirectionLint;
