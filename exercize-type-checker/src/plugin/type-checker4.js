const { declare } = require("@babel/helper-plugin-utils");

function resolveType(targetType, referenceTypesMap = {}) {
  const tsTypeAnnotationMap = {
    TSStringKeyword: "string",
    TSNumberKeyword: "number",
  };
  switch (targetType.type) {
    case "TSTypeAnnotation": // 变量后面有: 类型是 'TSTypeReference'
      if (targetType.typeAnnotation.type === "TSTypeReference") {
        // TSTypeReference 代表泛型
        return referenceTypesMap[targetType.typeAnnotation.typeName.name];
      }
      return tsTypeAnnotationMap[targetType.typeAnnotation.type];
    case "TSNumberKeyword":
    case "NumberTypeAnnotation":
      return "number";
    case "StringTypeAnnotation":
      return "string";
    case "BooleanTypeAnnotation":
      return "boolean";
    case "NullLiteralTypeAnnotation":
      return "null";
    case "GenericTypeAnnotation":
      return "object";
  }
}

function noStackTraceWrapper(cb) {
  const tmp = Error.stackTraceLimit;
  Error.stackTraceLimit = 0;
  cb && cb(Error);
  Error.stackTraceLimit = tmp;
}

const noFuncAssignLint = declare((api, options, dirname) => {
  api.assertVersion(7); // babel7 调用

  return {
    pre(file) {
      file.set("errors", []);
    },
    // 案例: add<number>(1, '2');
    // 目的: 根据函数调用后面定义的类型来确定原函数后面的泛型类型
    // 最后通过 实参参数类型跟原函数参数类型列表的类型来比较
    visitor: {
      // 1. 匹配函数执行
      CallExpression(path, state) {
        const errors = state.file.get("errors");
        // 2. 找到函数后面定义的 <T> 类型
        const realTypes = path.node.typeParameters.params.map((item) => {
          return resolveType(item);
        });
        // 3. 确定实参类型, ['number', 'string']
        const argumentsTypes = path.get("arguments").map((item) => {
          return resolveType(item.getTypeAnnotation());
        });
        // 4. 获取调用函数的名字
        const calleeName = path.get("callee").toString();
        // 5. 获取原函数节点
        const functionDeclarePath = path.scope.getBinding(calleeName).path;
        // 6. 给原函数, 函数名后面的 <T> 的 T 赋值 类型
        const realTypeMap = {}; // 结果: { T: 'number' }
        functionDeclarePath.node.typeParameters.params.map((item, index) => {
          realTypeMap[item.name] = realTypes[index];
        });
        // 7. 确定原函数参数的类型, 结果: ['number', 'number']
        const declareParamsTypes = functionDeclarePath
          .get("params")
          .map((item) => {
            // 这里需要传入 item.node.typeAnnotation
            return resolveType(item.node.typeAnnotation, realTypeMap);
          });
        // 8. 遍历是实参列表跟形参列表类型是否一致, 如果不一致则将错误高亮增加到 state.file['_map'].errors中
        argumentsTypes.forEach((item, index) => {
          if (item !== declareParamsTypes[index]) {
            noStackTraceWrapper((Error) => {
              errors.push(
                path
                  .get("arguments." + index)
                  .buildCodeFrameError(
                    `${item} can not assign to ${declareParamsTypes[index]}`,
                    Error
                  )
              );
            });
          }
        });
      },
    },
    // 9. 打印高亮错误
    post(file) {
      console.log(file.get("errors"));
    },
  };
});

module.exports = noFuncAssignLint;
