/* jshint node:true, mocha:true, undef:true, unused:true */

var util = require('../lib');

var recast = require('recast');
var esprima = require('esprima');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var NodePath = types.NodePath;

var assert = require('assert');

function parse(source) {
  return recast.parse(source, { esprima: esprima });
}

function normalize(source) {
  return recast.prettyPrint(parse(source)).code;
}

function processIt(source, callback) {
  var ast = parse(source);
  types.traverse(ast, function(node) {
    if (n.Identifier.check(node) && node.name === 'IT') {
      callback.call(this, node);
    }
  });
  return ast;
}

function sameSource(actual, expected, message) {
  actual = (typeof actual === 'object') ?
    recast.prettyPrint(actual).code :
    normalize(actual);
  expected = (typeof expected === 'object') ?
    recast.prettyPrint(expected).code :
    normalize(expected);

  assert.equal(actual, expected, message);
}

describe('#uniqueIdentifier', function() {
  // Looks for an `IT` identifier and asserts that the first valid unique
  // identifier in that scope matches `expected`.
  function check(source, expected, name) {
    var identifier;

    processIt(source, function() {
      identifier = util.uniqueIdentifier(this.scope, name);
    });

    assert.equal(identifier.name, expected);
  }

  it('returns the first variable name when there are no variables', function() {
    check('IT;', '$__0');
  });

  it('returns the first variable not already declared', function() {
    check('var $__0, $__1; IT', '$__2');
  });

  it('returns the first variable not hoisted', function() {
    check('IT; var $__0, $__1;', '$__2');
  });

  it('skips conflicting argument names', function() {
    check('function foo(a, $__0, b) { IT; }', '$__1');
  });

  it('skips conflicting catch arguments', function() {
    check('try {} catch ($__0) { IT; }', '$__1');
  });

  it('skips conflicts from parent scopes', function() {
    check('var $__0; function outer($__1) { function $__2() { IT; } }', '$__3');
  });

  it('ignores variables that will shadow inner scopes', function() {
    check('IT; (function($__0){ var $__1; })();', '$__0');
  });

  it('skips references to global scope', function() {
    check('$__0; IT;', '$__1');
  });

  it('allows specifying a descriptive name', function() {
    check('IT;', '$__aName', 'aName');
  });

  it('adds numeric suffixes to descriptive names if need be', function() {
    check('var $__o; $__o0; (function($__o1){ IT; }); function $__o2(){}', '$__o3', 'o');
  });

  it('converts descriptive names to identifiers', function() {
    check('IT;', '$__Hello$there$$how$are$you$', 'Hello there, how are you?');
  });
});

describe('#isUsed', function() {
  function check(source, names, expected) {
    var ast = parse(source).program;
    var rootPath = new NodePath({ root: ast });
    var globalScope = rootPath.get('root').scope;

    if (typeof names === 'string') {
      names = [names];
    }

    names.forEach(function(name) {
      var actual = util.isUsed(globalScope, name);

      assert.ok(
        actual === expected,
        'expected `' + name + '` ' +
        (expected ? '' : 'not ') +
        'to be used globally by `' + JSON.stringify(source) + '`'
      );
    });
  }

  it('is true for globals declared at the top level', function() {
    check('var a;', 'a', true);
  });

  it('is true for globals referenced at the top level', function() {
    check('a;', 'a', true);
  });

  it('is false for a variable not declared in scope or referenced anywhere', function() {
    check('var a, b; c;', 'd', false);
  });

  it('is false in the global scope for variables declared in inner scopes', function() {
    check('function foo(a) { var b; }', ['a', 'b'], false);
  });

  it('is true for global references used within inner scopes', function() {
    check('function foo() { return a + b; }', ['a', 'b'], true);
  });
});

describe('#isReference', function() {
  function check(source, expected, filter) {
    processIt(source, function() {
      if (!filter || filter(this)) {
        assert.equal(
          util.isReference(this),
          expected,
          'expected `IT` in `' + source + '` to ' +
            (expected ? '' : 'not ') + 'be a reference'
        );
      }
    });
  }

  it('is false for variable declaration identifiers', function() {
    check('var IT;', false);
  });

  it('is true for global property accesses', function() {
    check('IT;', true);
    check('IT.foo', true);
  });

  it('is false for function parameters', function() {
    check('(function(IT){})', false);
  });

  it('is false for catch arguments', function() {
    check('try{}catch(IT){}', false);
  });

  it('is true for variable references', function() {
    check('var IT; foo(IT);', true, function(path) {
      return n.CallExpression.check(path.parent.value);
    });
  });

  it('is false for property keys', function() {
    check('({IT: 1})', false);
  });

  it('is true for property values', function() {
    check('({a: IT})', true);
    check('({IT: IT})', true, function(path) {
      return path.parent.value === path.value;
    });
  });

  it('is false for labeled statements', function() {
    check('IT: 1', false);
    check('IT: IT', true, function(path) {
      return n.ExpressionStatement.check(path.parent.value);
    });
  });

  it('can check names', function() {
    types.traverse(parse('a'), function(node) {
      if (n.Identifier.check(node)) {
        assert.ok(util.isReference(this, 'a'));
        assert.ok(!util.isReference(this, 'b'));
      }
    });
  });

  it('is false for class names', function() {
    check('class IT {}', false);
    check('var foo = class IT {};', false);
  });

  it('is false for method definition identifiers', function() {
    check('class Foo { IT(){} }', false);
  });

  it('is false for function definition identifiers', function() {
    check('function IT(){}', false);
  });

  it('is true for superclass identifiers', function() {
    check('class Foo extends IT {}', true);
  });

  it('is false for name of import specifiers', function() {
    check('import IT from "IT";', false);
    check('import { IT } from "IT";', false);
    check('import { foo as IT } from "IT";', false);
    check('import { IT as foo } from "IT";', false);
  });

  it('is true for export default', function() {
    check('export default IT;', true);
  });
});

describe('#injectVariable', function() {
  it('creates a variable in the scope node', function() {
    var identifier = b.identifier('a');
    var ast = processIt('function foo(){ IT; }', function() {
      assert.strictEqual(
        util.injectVariable(this.scope, identifier),
        identifier
      );
    });

    sameSource(ast, 'function foo(){ var a; IT; }');
  });

  it('marks the variable as bound in the given scope', function() {
    var identifier = b.identifier('a');
    var scope;

    processIt('function foo(){ IT; }', function() {
      scope = this.scope;
      assert.strictEqual(
        util.injectVariable(scope, identifier),
        identifier
      );
    });

    assert.ok(scope.declares('a'), 'injected variables should count as declared');
    assert.ok(!scope.parent.declares('a'), 'injected variables should not pollute parent scopes');
  });

  it('can create a variable with an initial value', function() {
    var ast = processIt('IT;', function() {
      util.injectVariable(
        this.scope,
        b.identifier('hasOwnProp'),
        b.memberExpression(
          b.memberExpression(
            b.identifier('Object'),
            b.identifier('prototype'),
            false
          ),
          b.identifier('hasOwnProperty'),
          false
        )
      );
    });

    sameSource(ast,'var hasOwnProp = Object.prototype.hasOwnProperty; IT;');
  });

  it('can inject a variable in a scope at a position that is later replaced', function() {
    var ast = parse('var a;');

    types.traverse(ast, function(node) {
      if (n.VariableDeclaration.check(node)) {
        util.injectVariable(this.scope, b.identifier('b'));
        this.replace(b.expressionStatement(
          b.callExpression(b.identifier('replacement'), [])
        ));
      }
    });

    sameSource(
      ast,
      'var b; replacement();'
    );
  });
});

describe('#injectShared', function() {
  var hasOwnPropAST = b.memberExpression(
    b.memberExpression(
      b.identifier('Object'),
      b.identifier('prototype'),
      false
    ),
    b.identifier('hasOwnProperty'),
    false
  );

  var arraySliceAST = b.memberExpression(
    b.memberExpression(
      b.identifier('Array'),
      b.identifier('prototype'),
      false
    ),
    b.identifier('slice'),
    false
  );

  it('can inject a shared value', function() {
    var ast = processIt('IT;', function() {
      assert.equal(
        util.injectShared(
          this.scope,
          'hasOwnProperty',
          hasOwnPropAST
        ).name,
        '$__hasOwnProperty'
      );

      // do it again under the same name
      assert.equal(
        util.injectShared(
          this.scope,
          'hasOwnProperty',
          hasOwnPropAST
        ).name,
        '$__hasOwnProperty'
      );

      // add a different shared variable
      assert.equal(
        util.injectShared(
          this.scope,
          'arraySlice',
          arraySliceAST
        ).name,
        '$__arraySlice'
      );
    });

    sameSource(
      ast,
      'var $__arraySlice = Array.prototype.slice;' +
      'var $__hasOwnProperty = Object.prototype.hasOwnProperty;' +
      'IT;'
    );
  });
});

describe('#callHasOwnProperty', function() {
  it('returns a CallExpression with the given object and property', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callHasOwnProperty(this.scope, node, 'is'));
    });

    sameSource(
      ast,
      'var $__Object$prototype$hasOwnProperty = Object.prototype.hasOwnProperty;' +
      '$__Object$prototype$hasOwnProperty.call(IT, "is");'
    );
  });
});

describe('#callGetOwnPropertyDescriptor', function() {
  it('returns a CallExpression with the given object and property', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callGetOwnPropertyDescriptor(this.scope, node, 'is'));
    });

    sameSource(
      ast,
      'var $__Object$getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;' +
      '$__Object$getOwnPropertyDescriptor(IT, "is");'
    );
  });
});

describe('#callGetPrototypeOf', function() {
  it('returns a CallExpression with the given object', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callGetPrototypeOf(this.scope, node));
    });

    sameSource(
      ast,
      'var $__Object$getPrototypeOf = Object.getPrototypeOf;' +
      '$__Object$getPrototypeOf(IT);'
    );
  });
});

describe('#callArraySlice', function() {
  it('returns a CallExpression with the given object and omits missing begin/end', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callArraySlice(this.scope, node));
    });

    sameSource(
      ast,
      'var $__Array$prototype$slice = Array.prototype.slice;' +
      '$__Array$prototype$slice.call(IT);'
    );
  });

  it('returns a CallExpression with the given object and begin/end', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callArraySlice(this.scope, node, 1, 2));
    });

    sameSource(
      ast,
      'var $__Array$prototype$slice = Array.prototype.slice;' +
      '$__Array$prototype$slice.call(IT, 1, 2);'
    );
  });
});

describe('#callFunctionBind', function() {
  it('uses call when given args as an array', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callFunctionBind(
        this.scope,
        node,
        b.thisExpression(),
        [b.literal(1)]
      ));
    });

    sameSource(
      ast,
      'var $__Function$prototype$bind = Function.prototype.bind;' +
      '$__Function$prototype$bind.call(IT, this, 1);'
    );
  });

  it('uses apply when given args as an expression', function() {
    var ast = processIt('IT;', function(node) {
      this.replace(util.callFunctionBind(
        this.scope,
        node,
        b.thisExpression(),
        b.identifier('args')
      ));
    });

    sameSource(
      ast,
      'var $__Function$prototype$bind = Function.prototype.bind;' +
      '$__Function$prototype$bind.apply(IT, [this].concat(args));'
    );
  });
});

describe('#getGlobals', function() {
  function check(source, globals) {
    assert.deepEqual(
      util.getGlobals(parse(source).program).map(function(identifier) {
        return identifier.name;
      }),
      globals
    );
  }

  it('is empty when there are no references', function() {
    check('', []);
  });

  it('has references from the top level', function() {
    check('a; b(c + d);', ['a', 'b', 'c', 'd']);
  });

  it('ignores references that have associated variable declarations', function() {
    check('var a; a + b;', ['b']);
  });

  it('ignores references that have associated function params', function() {
    check('function area(r){ return Math.PI * Math.pow(r, 2); }', ['Math']);
  });

  it('ignores references that have associated catch arguments', function() {
    check('try {} catch (a) { a + b["c"]; }', ['b']);
  });

  it('ignores references to declared functions', function() {
    check('foo(); function foo() {}', []);
  });

  it('ignores references to things declared in outer scopes', function() {
    check('var a; function foo() { return a; }', []);
  });

  it('ignores references to function expression identifiers within the function', function() {
    check('var a = function b(){ return b; };', []);
  });
});
