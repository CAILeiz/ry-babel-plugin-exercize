const { declare } = require("@babel/helper-plugin-utils");
const doctrine = require("doctrine");
const fse = require("fs-extra");
const path = require("path");
const renderer = require("./renderer");

// 解析注释
function parseComment(commentStr) {
  if (!commentStr) {
    return;
  }
  return doctrine.parse(commentStr, {
    unwrap: true,
  });
}

// 根据文档类型生成不同的后缀文档
function generate(docs, format = "json") {
  if (format === "markdown") {
    return {
      ext: ".md",
      content: renderer.markdown(docs),
    };
  } else if (format === "html") {
    return {
      ext: "html",
      content: renderer.html(docs),
    };
  } else {
    return {
      ext: "json",
      content: renderer.json(docs),
    };
  }
}

// 生成类型
function resolveType(tsType) {
  const typeAnnotation = tsType.typeAnnotation;
  if (!typeAnnotation) {
    return;
  }
  switch (typeAnnotation.type) {
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";
  }
}

const autoDocumentPlugin = declare((api, options, dirname) => {
  api.assertVersion(7);

  return {
    // 1. pre 钩子, 用于给 state.file['_map'].docs = [] 赋值
    pre(file) {
      file.set("docs", []);
    },
    // 2. 解析遍历源码
    visitor: {
      // 3. 找到函数声明(function() {}),
      // 定义函数类型,找到函数名/函数参数/函数返回值类型/
      // 以及找到函数前面注释(包括函数功能注释以及函数参数注释-函数参数注释是根据@xx类型来定义的)
      FunctionDeclaration(path, state) {
        const docs = state.file.get("docs");
        docs.push({
          type: "function",
          name: path.get("id").toString(), // 函数名称 -> 获取 path.node.id.name
          params: path.get("params").map((paramPath) => {
            return {
              name: paramPath.toString(), // 获取 paramPath.name
              type: resolveType(paramPath.getTypeAnnotation()),
            };
          }), // 获取 path.node.params.typeAnnotation
          return: resolveType(path.get("returnType").getTypeAnnotation()), // 获取 path.node.returnType.typeAnnotation
          doc:
            path.node.leadingComments &&
            parseComment(path.node.leadingComments[0].value),
          // doc ==> 只获取第一个当前函数前面的注释, 解析成:
          // {
          //    description: 'say 你好',
          //     tags: [
          //         {
          //             description: '名字',
          //             name: 'name',
          //             title: 'param',
          //             type: undefined
          //         }
          //     ]
          // }
        });
        state.file.set("docs", docs);
      },
      // 4. 匹配类函数,
      // - 定义函数类型
      // - 找到函数名称
      // - path.traverse 遍历, 匹配 函数 property, constructor, 函数 method (分别找到属性名称/属性类型/属性的前后注释, 原型的参数[参数名称/类型/参数前面注释], 方法名称/方法前面第一个注释/方法参数[参数的名称及类型])
      ClassDeclaration(path, state) {
        const docs = state.file.get("docs");
        const classInfo = {
          type: "class",
          name: path.get("id").toString(), // node.id.name
          constructorInfo: {},
          methodsInfo: [],
          propertiesInfo: [],
        };
        if (path.node.leadingComments) {
          classInfo.doc = parseComment(path.node.leadingComments[0].value); // 通过 doctrine 插件将注释解析成 description 函数作用名 及 tags 参数介绍
        }
        path.traverse({
          ClassProperty(path) {
            classInfo.propertiesInfo.push({
              name: path.get("key").toString(), // toString() 获取.name, node.key.name
              type: resolveType(path.getTypeAnnotation()), // 为 'TSTypeAnnotation'
              doc: [path.node.leadingComments, path.node.trailingComments] // leadingComments 前注释, trailingComments 后注释
                .filter(Boolean)
                .map((comment) => {
                  return parseComment(comment.value);
                })
                .filter(Boolean),
            });
          },
          ClassMethod(path) {
            if (path.node.kind === "constructor") {
              //
              classInfo.constructorInfo = {
                params: path.get("params").map((paramPath) => {
                  return {
                    name: paramPath.toString(),
                    type: resolveType(paramPath.getTypeAnnotation()),
                    doc: parseComment(path.node.leadingComments[0].value),
                  };
                }),
              };
            } else {
              classInfo.methodsInfo.push({
                name: path.get("key").toString(),
                doc: parseComment(path.node.leadingComments[0].value),
                params: path.get("params").map((paramPath) => {
                  return {
                    name: paramPath.toString(),
                    type: resolveType(paramPath.getTypeAnnotation()),
                  };
                }),
                return: resolveType(path.getTypeAnnotation()),
              });
            }
          },
        });
        docs.push(classInfo);
        state.file.set("docs", docs);
      },
    },
    // 5. 最后将存储的 docs 根据 options的 format 跟 输出目录输出
    post(file) {
      const docs = file.get("docs");
      const res = generate(docs, options.format);
      fse.ensureDirSync(options.outputDir);
      fse.writeFileSync(
        path.join(options.outputDir, "docs" + res.ext),
        res.content
      );
    },
  };
});

module.exports = autoDocumentPlugin;
