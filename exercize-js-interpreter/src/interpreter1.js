// ast链接: https://astexplorer.net/#/gist/592aa28934f75ee455d3c8dc77ae4e8f/1c4792fbf4d4da561792e8b34171777417304a80

const parser = require("@babel/parser");
const { codeFrameColumns } = require("@babel/code-frame");
let chalk = require("chalk");

const sourceCode = `
   const a = 1 + 2;
   console.log(a);
`;

const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
});

// 定义工具类
class Scope {
  constructor(parentScope) {
    this.parent = parentScope;
    this.declarations = {}; // 存放工具方法以及 key: value
  }

  set(name, value) {
    // 设置 key: value
    this.declarations[name] = value;
  }

  getLocal(name) {
    // 获取值
    return this.declarations[name];
  }

  get(name) {
    // 递归获取 key
    let res = this.getLocal(name);
    if (res === undefined && this.parent) {
      res = this.parent.get(name);
    }
    return res;
  }

  has(name) {
    // 判断是否有
    return !!this.getLocal(name);
  }
}
// 源码: const a = 1 + 2, b = 3 + 2; 2. let c= 2
const evaluator = (function () {
  // 解释器-工厂模式
  // 1. 定义解析 ast 解释器
  const astInterpreters = {
    Program(node, scope) {
      // node.body: [VariableDeclaration1, VariableDeclaration2]
      node.body.forEach((item) => {
        evaluate(item, scope);
      });
    },
    // 解析变量
    // node.declarations: ['const a = 1 + 2, b = 3 + 2',  'let c= 2']
    VariableDeclaration(node, scope) {
      node.declarations.forEach((item) => {
        evaluate(item, scope);
      });
    },
    VariableDeclarator(node, scope) {
      const declareName = evaluate(node.id);
      if (scope.get(declareName)) {
        throw Error("duplicate declare variable：" + declareName);
      } else {
        scope.set(declareName, evaluate(node.init, scope));
      }
    },
    // 解释表达式 console.log(xxx)
    ExpressionStatement(node, scope) {
      return evaluate(node.expression, scope);
    },
    // console.log 的类型是 MemberExpression
    MemberExpression(node, scope) {
      const obj = scope.get(evaluate(node.object)); // scope中全局定义的, console 函数
      // 给变量名赋值 值
      return obj[evaluate(node.property)]; // 获取 log 函数
    },
    // 解释 console.log(xxx)
    CallExpression(node, scope) {
      const fn = evaluate(node.callee, scope); // 获取 .log 函数, log: fn, node.callee.type 为 MemberExpression
      // 获取参数变量
      const args = node.arguments.map((item) => {
        if (item.type === "Identifier") {
          return scope.get(item.name);
        }
        return evaluate(item, scope);
      });
      if (node.callee.type === "MemberExpression") {
        const obj = evaluate(node.callee.object, scope); // console
        return fn.apply(obj, args);
      } else {
        return fn.apply(null, args);
      }
    },
    BinaryExpression(node, scope) {
      const leftValue = evaluate(node.left, scope);
      const rightValue = evaluate(node.right, scope);
      switch (node.operator) {
        case "+":
          return leftValue + rightValue;
        case "-":
          return leftValue - rightValue;
        case "*":
          return leftValue * rightValue;
        case "/":
          return leftValue / rightValue;
        default:
          throw Error("upsupported operator：" + node.operator);
      }
    },
    // 返回变量的名称
    Identifier(node, scope) {
      return node.name;
    },
    // 返回数字的值
    NumericLiteral(node, scope) {
      return node.value;
    },
  };

  const evaluate = (node, scope) => {
    try {
      return astInterpreters[node.type](node, scope);
    } catch (e) {
      if (
        e &&
        e.message &&
        e.message.indexOf("astInterpreters[node.type] is not a function") != -1
      ) {
        console.error("unsupported ast type: " + node.type);
        console.error(
          codeFrameColumns(sourceCode, node.loc, {
            highlightCode: true,
          })
        );
      } else {
        console.error(node.type + ":", e.message);
        console.error(
          codeFrameColumns(sourceCode, node.loc, {
            highlightCode: true,
          })
        );
      }
    }
  };
  return {
    evaluate,
  };
})();

const globalScope = new Scope();
globalScope.set("console", {
  log: function (...args) {
    console.log(chalk.green(...args));
  },
  error: function (...args) {
    console.log(chalk.red(...args));
  },
  error: function (...args) {
    console.log(chalk.orange(...args));
  },
});
evaluator.evaluate(ast.program, globalScope);

console.log(globalScope);
