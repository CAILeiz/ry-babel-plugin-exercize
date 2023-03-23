const { declare } = require("@babel/helper-plugin-utils");

function canExistAfterCompletion(path) {
  return (
    path.isFunctionDeclaration() ||
    path.isVariableDeclaration({
      kind: "var",
    })
  );
}

const compress = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    pre(file) {
      file.set("uid", 0);
    },
    visitor: {
      // 1. 匹配块级文档, 过滤 return 函数后面不是函数声明跟变量声明的语句
      BlockStatement(path) {
        const statementPaths = path.get("body");
        let purge = false;
        for (let i = 0; i < statementPaths.length; i++) {
          const isReturnFlag = statementPaths[i].isCompletionStatement(); // 判断是不是 return 语句
          if (isReturnFlag) {
            purge = true;
            continue;
          }

          if (purge && !canExistAfterCompletion(statementPaths[i])) {
            statementPaths[i].remove(); // 删除自己
          }
        }
      },
      // 2. 匹配块级变量别名,
      Scopable(path) {
        Object.entries(path.scope.bindings).forEach(([key, binding]) => {
          if (!binding.referenced) {
            // 变量是不是函数赋值, binding.path.get("init")
            if (binding.path.get("init").isCallExpression()) {
              // 判断是不是一个函数, 如果前面有 'PURE' 标识, 如果有则删除
              const comments = binding.path.get("init").node.leadingComments;
              if (comments && comments[0]) {
                if (comments[0].value.includes("PURE")) {
                  // 如果是纯的, 过滤
                  binding.path.remove();
                  return;
                }
              }
            }
            // 判断是不是纯的, 如果不是纯的, 替换后面的, 如果是纯的直接删除
            if (!path.scope.isPure(binding.path.node.init)) {
              binding.path.parentPath.replaceWith(
                api.types.expressionStatement(binding.path.node.init)
              );
            } else {
              binding.path.remove();
            }
          }
        });
      },
    },
  };
});

module.exports = compress;
