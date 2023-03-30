// ast: https://astexplorer.net/#/gist/efdc75203c127c7bdb9986bdb83fe2c7/60eb8c67f86b303f89a0e3e6d65d5edd60dea8cf

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const fs = require("fs");
const path = require("path");
const DependencyNode = require("./DependencyNode");

const visitedModules = new Set(); // 记录访问过的模块

const IMPORT_TYPE = {
  deconstruct: "deconstruct",
  default: "default",
  namespace: "namespace",
};
const EXPORT_TYPE = {
  all: "all",
  default: "default",
  named: "named",
};

// @description 通过路径的后缀来指定当时 ast 插件解析的类型
function resolveBabelSyntaxtPlugins(modulePath) {
  const plugins = [];
  if ([".tsx", ".jsx"].some((ext) => modulePath.endsWith(ext))) {
    plugins.push("jsx");
  }
  if ([".ts", ".tsx"].some((ext) => modulePath.endsWith(ext))) {
    plugins.push("typescript");
  }
  return plugins;
}

// 判断当前路径是否存在并且当前路径是否是目录
function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (e) {}
  return false;
}

// 补全路径
function completeModulePath(modulePath) {
  const EXTS = [".tsx", ".ts", ".jsx", ".js"];
  if (modulePath.match(/\.[a-zA-Z]+$/)) {
    return modulePath;
  }
  // 传入一个函数用来跟 EXTS 每一项拼接成完整路径, 如果路径存在则返回
  function tryCompletePath(resolvePath) {
    for (let i = 0; i < EXTS.length; i++) {
      let tryPath = resolvePath(EXTS[i]);
      if (fs.existsSync(tryPath)) {
        return tryPath;
      }
    }
  }
  // 路径找不到返回 not found
  function reportModuleNotFoundError(modulePath) {
    throw "module not found: " + modulePath;
  }

  if (isDirectory(modulePath)) {
    const tryModulePath = tryCompletePath((ext) =>
      path.join(modulePath, "index" + ext)
    );
    if (!tryModulePath) {
      reportModuleNotFoundError(modulePath);
    } else {
      return tryModulePath;
    }
  } else if (!EXTS.some((ext) => modulePath.endsWith(ext))) {
    // 如果不当前路径不是目录, 则后面直接拼接 EXTS 中的每一项, 路径存在返回, 不存在报错
    const tryModulePath = tryCompletePath((ext) => modulePath + ext);
    if (!tryModulePath) {
      reportModuleNotFoundError(modulePath);
    } else {
      return tryModulePath;
    }
  }
  return modulePath;
}

// 模块解析, 根据父路径跟导入的子路精返回全路径
function moduleResolver(curModulePath, requirePath) {
  requirePath = path.resolve(path.dirname(curModulePath), requirePath);

  // 过滤掉第三方模块
  if (requirePath.includes("node_modules")) {
    return "";
  }

  requirePath = completeModulePath(requirePath);

  if (visitedModules.has(requirePath)) {
    return "";
  } else {
    visitedModules.add(requirePath);
  }
  return requirePath;
}

function traverseJsModule(curModulePath, dependencyGrapthNode, allModules) {
  const moduleFileContent = fs.readFileSync(curModulePath, {
    encoding: "utf-8",
  });
  dependencyGrapthNode.path = curModulePath; // 给当前
  // 1. 转成 ast
  const ast = parser.parse(moduleFileContent, {
    sourceType: "unambiguous",
    plugins: resolveBabelSyntaxtPlugins(curModulePath),
  });
  // 2. 匹配导入导出函数
  traverse(ast, {
    ImportDeclaration(path) {
      // 1. 获取子路径
      const subModulePath = moduleResolver(
        curModulePath,
        path.get("source.value").node
      );
      if (!subModulePath) {
        return;
      }

      const specifierPaths = path.get("specifiers");
      dependencyGrapthNode.imports[subModulePath] = specifierPaths.map(
        (specifierPath) => {
          if (specifierPath.isImportSpecifier()) {
            return {
              type: IMPORT_TYPE.deconstruct,
              imported: specifierPath.get("imported").node.name,
              local: specifierPath.get("local").node.name,
            };
          } else if (specifierPath.isImportDefaultSpecifier()) {
            return {
              type: IMPORT_TYPE.default,
              local: specifierPath.get("local").node.name,
            };
          } else {
            return {
              type: IMPORT_TYPE.namespace,
              local: specifierPath.get("local").node.name,
            };
          }
        }
      );

      const subModule = new DependencyNode(); // 重新构建子路径的模块依赖对象
      traverseJsModule(subModulePath, subModule, allModules); // 递归获取到子模块的依赖信息
      dependencyGrapthNode.subModules[subModule.path] = subModule;
    },
    ExportDeclaration(path) {
      // 如果是别名导出
      if (path.isExportNamedDeclaration()) {
        const specifiers = path.get("specifiers"); // 'specifiers'所有定义的变量
        dependencyGrapthNode.exports = specifiers.map((specifierPath) => ({
          type: EXPORT_TYPE.named,
          exported: specifierPath.get("exported").node.name,
          local: specifierPath.get("local").node.name,
        }));
      } else if (path.isExportDefaultDeclaration()) {
        // type 是 'ExportDefaultDeclaration'
        // 如果是默认导出
        let exportName;
        const declarationPath = path.get("declaration");
        if (declarationPath.isAssignmentExpression()) {
          exportName = declarationPath.get("left").toString();
        } else {
          exportName = declarationPath.toString();
        }
        dependencyGrapthNode.exports.push({
          type: EXPORT_TYPE.default,
          exported: exportName,
        });
      } else {
        dependencyGrapthNode.exports.push({
          type: EXPORT_TYPE.all,
          exported: path.get("exported").node.name,
          source: path.get("source").node.value,
        });
      }
    },
  });
  // 3. 放到 allModules 中
  allModules[curModulePath] = dependencyGrapthNode;
}

module.exports = function (curModulePath) {
  const dependencyGraph = {
    root: new DependencyNode(),
    allModules: {},
  };
  traverseJsModule(
    curModulePath,
    dependencyGraph.root,
    dependencyGraph.allModules
  );
  return dependencyGraph;
};
