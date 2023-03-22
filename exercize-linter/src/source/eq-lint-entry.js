const four = /* foo */ add(2, 2);

a == b; // 都不是字面量, 类型都是 'undefined'
foo == true; // foo 不是字面量, 类型分别为 'undefined', 'boolean'
bananas != 1; // bananas 不是字面量, 1 字面量, 类型分别为 'undefined', 'number'
value == undefined; // 都不是字面量, 类型都是 'undefined'
typeof foo == "undefined"; // typeof foo 不是字面量, 类型分别为 'undefined', 'string'
"hello" != "world"; // 都是字面量, 类型都是 'string'
0 == 0; // 都是字面量, 类型都是 'number'
true == true; // 都是字面量, 类型都是 'boolean'
