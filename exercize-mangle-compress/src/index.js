const { transformFromAstSync } = require("@babel/core");
const parser = require("@babel/parser");
const manglePlugin = require("./plugin/mangle");
const compressPlugin = require("./plugin/compress");

const sourceCode = `
    function func() {
        const num1 = 1;
        const num2 = 2;
        const num3 = /*@__PURE__*/add(1, 2); // num3 没有用到不会进行遍历
        const num4 = add(3, 4);
        console.log(num2);
        return num2;
        console.log(num1);
        function add (aaa, bbb, ccc) {
            var ddd = 2
            let eee = 3
            let sjosojos = 2 // sjosojos 没有用到遍历 scope.bindings 遍历不到
            return aaa + bbb + ccc + ddd + eee;

        }
    }
    func();
`;

const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
  comments: true,
});

const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [[manglePlugin], [compressPlugin]],
  generatorOpts: {
    comments: false, // true: 注释存在
    compact: true, // true: 变成一行
  },
});

console.log(code);
