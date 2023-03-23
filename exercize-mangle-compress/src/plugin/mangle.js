const { declare } = require("@babel/helper-plugin-utils");

// 生成混淆的唯一的 key 名字
const base54 = (function () {
  var DIGITS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";
  return function (num) {
    var ret = "";
    do {
      ret = DIGITS.charAt(num % 54) + ret;
      num = Math.floor(num / 54);
    } while (num > 0);
    return ret;
  };
})();

const mangle = declare((api, options, dirname) => {
  api.assertVersion(7); // 使用 babel7

  return {
    // 在全局 state['_map'] 设置 uid
    pre(file) {
      file.set("uid", 0);
    },
    visitor: {
      // 1. 块级作用域别名
      // 引用地址: https://github.com/babel/babel/blob/main/packages/babel-types/src/ast-types/generated/index.ts#L2489-L2535
      // 遍历规则: 先从最下最内遍历, 遍历的是变量 [path.scope.bindings] 用到的变量
      Scopable: {
        exit(path, state) {
          let uid = state.file.get("uid");
          Object.entries(path.scope.bindings).forEach(([key, binding]) => {
            if (binding.mangled) return;
            binding.mangled = true;
            const newUidName = base54(uid++); // 获取新的名字
            const newName = path.scope.generateUid(newUidName); // 根据 generateUid 生成唯一的 uid 在前面增加 '_'
            binding.path.scope.rename(key, newName); // 在当前作用域替换全部变量
          });
          state.file.set("uid", uid);
        },
      },
    },
  };
});

module.exports = mangle;
