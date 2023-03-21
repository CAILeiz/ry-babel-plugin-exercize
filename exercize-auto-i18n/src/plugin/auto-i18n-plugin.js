const { declare } = require("@babel/helper-plugin-utils");
const fse = require("fs-extra");
const path = require("path");
const generate = require("@babel/generator").default;

let intlIndex = 0;
function nextIntlKey() {
  ++intlIndex;
  return `intl${intlIndex}`;
}

// 1. declare 声明一个插件
const autoTrackPlugin = declare((api, options, dirname) => {
  api.assertVersion(7);
  // 2. 如果没有目录, 直接返回并提示输出目录为空
  if (!options.outputDir) {
    throw new Error("outputDir in empty");
  }

  function getReplaceExpression(path, value, intlUid) {
    // 处理字符串或者模板字符串为 ast 表达式
    const expressionParams = path.isTemplateLiteral()
      ? path.node.expressions.map((item) => generate(item).code)
      : null;
    let replaceExpression = api.template.ast(
      `${intlUid}.t('${value}'${
        expressionParams ? "," + expressionParams.join(",") : ""
      })`
    ).expression;
    if (
      path.findParent((p) => p.isJSXAttribute()) &&
      !path.findParent((p) => p.isJSXExpressionContainer())
    ) {
      replaceExpression = api.types.JSXExpressionContainer(replaceExpression);
    }
    return replaceExpression;
  }

  function save(file, key, value) {
    // 读取固定值保存在 intl 配置对象中, 具体保存在 state.file['_map'].allText 中
    const allText = file.get("allText");
    allText.push({
      key,
      value,
    });
    file.set("allText", allText);
  }

  return {
    // 4. 给state中的file._map 设置 allText 为 []
    pre(file) {
      file.set("allText", []);
    },
    visitor: {
      // 5. 定义 Program 钩子, 用来处理 intl 引入及 import 及 'i18n-disable' 的跳过字段标识(给node节点 skipTransform 打标)
      Program: {
        enter(path, state) {
          let imported;
          path.traverse({
            ImportDeclaration(p) {
              const source = p.node.source.value; // 此时值为 intl2, 所以 imported = undefined
              if (source === "intl") {
                imported = true;
              }
            },
          });
          if (!imported) {
            const uid = path.scope.generateUid("intl");
            const importAst = api.template.ast(`import ${uid} from 'intl'`);
            path.node.body.unshift(importAst);
            state.intlUid = uid;
          }

          path.traverse({
            "StringLiteral|TemplateLiteral"(path) {
              if (path.node.leadingComments) {
                path.node.leadingComments = path.node.leadingComments.filter(
                  (comment, index) => {
                    if (comment.value.includes("i18n-disable")) {
                      path.node.skipTransform = true;
                      return false;
                    }
                    return true;
                  }
                );
              }
              if (path.findParent((p) => p.isImportDeclaration())) {
                path.node.skipTransform = true;
              }
            },
          });
        },
      },
      // 6. 处理字符串
      StringLiteral(path, state) {
        if (path.node.skipTransform) {
          return;
        }
        // 获取唯一key, 如 'intl1'
        let key = nextIntlKey();
        // 将 key 跟 path.node.value 保存在 state.file['_map'].allText 中
        save(state.file, key, path.node.value);

        const replaceExpression = getReplaceExpression(
          path,
          key,
          state.intlUid
        );
        // 替换节点并跳过
        path.replaceWith(replaceExpression);
        path.skip();
      },
      // 6. 处理模板
      TemplateLiteral(path, state) {
        if (path.node.skipTransform) {
          return;
        }
        // 获取固定值, 中间用 {placeholder} 隔开
        const value = path
          .get("quasis")
          .map((item) => item.node.value.raw)
          .join("{placeholder}");

        if (value) {
          // 将 key 跟 path.node.value 保存在 state.file['_map'].allText 中
          let key = nextIntlKey();
          save(state.file, key, value);

          const replaceExpression = getReplaceExpression(
            path,
            key,
            state.intlUid
          );
          // 替换节点并跳过
          path.replaceWith(replaceExpression);
          path.skip();
        }
        // path.get('quasis').forEach(templateElementPath => {
        //     const value = templateElementPath.node.value.raw;
        //     if(value) {
        //         let key = nextIntlKey();
        //         save(state.file, key, value);

        //         const replaceExpression = getReplaceExpression(templateElementPath, key, state.intlUid);
        //         templateElementPath.replaceWith(replaceExpression);
        //     }
        // });
        // path.skip();
      },
    },
    // 7. 遍历 allText 用 fse 模块打印 输出 intl 配置对象
    post(file) {
      const allText = file.get("allText");
      const intlData = allText.reduce((obj, item) => {
        obj[item.key] = item.value;
        return obj;
      }, {});

      const content = `const resource = ${JSON.stringify(
        intlData,
        null,
        4
      )};\nexport default resource;`;
      fse.ensureDirSync(options.outputDir);
      fse.writeFileSync(path.join(options.outputDir, "zh_CN.js"), content);
      fse.writeFileSync(path.join(options.outputDir, "en_US.js"), content);
    },
  };
});
module.exports = autoTrackPlugin;
