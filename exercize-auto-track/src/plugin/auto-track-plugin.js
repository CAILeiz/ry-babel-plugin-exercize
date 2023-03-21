const { declare } = require("@babel/helper-plugin-utils");
const importModule = require("@babel/helper-module-imports");

// 1. 通过 declare 生成插件
const autoTrackPlugin = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    visitor: {
      Program: {
        // 2. 入口
        enter(path, state) {
          // 3. 遍历整个 code, 找到 import 导入的资源是否有  options.trackerPath,
          // 如果有 'track' 则 赋值 state.trackerImportId
          path.traverse({
            ImportDeclaration(curPath) {
              const requirePath = curPath.get("source").node.value;
              if (requirePath === options.trackerPath) {
                const specifierPath = curPath.get("specifiers.0");
                if (specifierPath.isImportSpecifier()) {
                  state.trackerImportId = specifierPath.toString();
                } else if (specifierPath.isImportNamespaceSpecifier()) {
                  state.trackerImportId = specifierPath.get("local").toString();
                }
                path.stop();
              }
            },
          });
          // 4. 如果没有 state.trackerImportId, 通过 importModule.addDefault 导入 track
          if (!state.trackerImportId) {
            state.trackerImportId = importModule.addDefault(path, "tracker", {
              nameHint: path.scope.generateUid("tracker"),
            }).name;
            state.trackerAST = api.template.statement(
              `${state.trackerImportId}()`
            )();
          }
        },
      },
      // 5. 类函数/箭头函数/普通函数/函数声明
      "ClassMethod|ArrowFunctionExpression|FunctionExpression|FunctionDeclaration"(
        path,
        state
      ) {
        const bodyPath = path.get("body");
        // 6. 如果是块级函数体
        if (bodyPath.isBlockStatement()) {
          bodyPath.node.body.unshift(state.trackerAST);
        } else {
          // 7. 如果不是需要添加函数体, 并替换
          const ast = api.template.statement(
            `{${state.trackerImportId}();return PREV_BODY;}`
          )({ PREV_BODY: bodyPath.node });
          bodyPath.replaceWith(ast);
        }
      },
    },
  };
});
module.exports = autoTrackPlugin;
