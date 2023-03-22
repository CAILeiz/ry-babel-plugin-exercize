const { declare } = require("@babel/helper-plugin-utils");

const noFuncAssignLint = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    pre(file) {
      file.set("errors", []);
    },
    visitor: {
      // 1. 匹配赋值表达式, 拿到赋值左边的属性名, 根据属性名在上下文中找到对应的节点
      // 判断节点是否是函数表达式或者是函数声明, 如果是记录错误信息
      AssignmentExpression(path, state) {
        const errors = state.file.get("errors");
        // 2. 拿到赋值左边的属性名
        const assignTarget = path.get("left").toString();
        // 3. 根据属性名在上下文中找到对应的节点
        const binding = path.scope.getBinding(assignTarget);
        if (binding) {
          // 判断节点是否是函数表达式或者是函数声明, 如果是记录错误信息
          if (
            binding.path.isFunctionDeclaration() ||
            binding.path.isFunctionExpression()
          ) {
            const tmp = Error.stackTraceLimit;
            Error.stackTraceLimit = 0;
            errors.push(
              path.buildCodeFrameError("can not reassign to function", Error)
            );
            Error.stackTraceLimit = tmp;
          }
        }
      },
    },
    // 4. 打印错误信息
    post(file) {
      console.log(file.get("errors"));
    },
  };
});

module.exports = noFuncAssignLint;
