# ast-util

Utilities for AST transformers.

## Install

```
$ npm install [--save] ast-util
```

## API

<a name="callArraySlice" href="#wiki-callArraySlice">#</a> <b>callArraySlice</b>(<i>scope</i>, <i>node</i>[, <i>begin</i>, <i>end</i>])

Returns a call to `Array.prototype.slice` with `node` as the context and
`begin` and `end` as the arguments to `slice`.


<a name="callFunctionBind" href="#wiki-callFunctionBind">#</a> <b>callFunctionBind</b>(<i>scope</i>, <i>fn</i>, <i>context</i>[, <i>args</i>])

Returns a call to `Function.prototype.bind` using either `call` or `apply`
depending on what the value of `args` is. If `args` is an expression then
`apply` is used. If `args` is an array of expressions, then `call`.


<a name="callGet" href="#wiki-callGet">#</a> <b>callGet</b>(<i>scope</i>, <i>object</i>, <i>property</i>, <i>receiver</i>)

The [[Get]] internal method on objects would look something like this
implemented in pure JavaScript:

```js
function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);
  if (desc === void 0) {
    var parent = Object.getPrototypeOf(object);
    if (parent === null) {
      return void 0;
    } else {
      return get(parent, property, receiver);
    }
  } else if ('value' in desc && 'writable' in desc) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === void 0) {
      return void 0;
    }
    return getter.call(receiver);
  }
}
```


<a name="callGetOwnPropertyDescriptor" href="#wiki-callGetOwnPropertyDescriptor">#</a> <b>callGetOwnPropertyDescriptor</b>(<i>scope</i>, <i>object</i>, <i>property</i>)

Returns a call to `Object.getOwnPropertyDescriptor` with the given `object` and
`property`.


<a name="callGetPrototypeOf" href="#wiki-callGetPrototypeOf">#</a> <b>callGetPrototypeOf</b>(<i>scope</i>, <i>object</i>)

Returns a call to `Object.getPrototypeOf` with the given `object`.


<a name="callHasOwnProperty" href="#wiki-callHasOwnProperty">#</a> <b>callHasOwnProperty</b>(<i>scope</i>, <i>node</i>, <i>property</i>)

Returns a call to `hasOwnProperty` with `node` as the context and `property` as
the property to check.


<a name="callSharedMethod" href="#wiki-callSharedMethod">#</a> <b>callSharedMethod</b>(<i>scope</i>, <i>callee</i>, <i>args</i>)

Returns a call to the given `callee` with `args` as the arguments. If `callee`
is a string then it is treated as a globally-accessible function such as
`Object.defineProperty` which will be stored in a unique temporary variable.
Subsequent calls to this function will re-use the same temporary variable.


<a name="callSharedMethodWithContext" href="#wiki-callSharedMethodWithContext">#</a> <b>callSharedMethodWithContext</b>(<i>scope</i>, <i>callee</i>, <i>context</i>, <i>args</i>)

Returns a call to the given `callee` with `context` as the method context and
`args` as the arguments. If `callee` is a string then it is treated as a
globally-accessible function such as `Array.prototype.slice` which will be
stored in a unique temporary variable. Subsequent calls to this function will
re-use the same temporary variable.


<a name="getGlobals" href="#wiki-getGlobals">#</a> <b>getGlobals</b>(<i>ast</i>)

Gets a list of identifiers referencing global variables anywhere within the
given `ast`. Assuming the ast is for this code:

```js
var a;
function b(){ return c; }
b(d);
```

Then `getGlobals` will return two identifiers, `c` and `a`.


<a name="identifierForString" href="#wiki-identifierForString">#</a> <b>identifierForString</b>(<i>string</i>)

Generate a safe JavaScript identifier for the given string.


<a name="injectShared" href="#wiki-injectShared">#</a> <b>injectShared</b>(<i>scope</i>, <i>name</i>, <i>expression</i>)

Injects a shared variable with a unique identifier. Only the first call with
the same `scope` and `name` will result in a variable declaration being
created. The `expression` passed in can either be an AST node or a function to
generate one. This function is generally used to inject repeatedly-used values
and prevent repeated execution.


<a name="injectVariable" href="#wiki-injectVariable">#</a> <b>injectVariable</b>(<i>scope</i>, <i>identifier</i>[, <i>init</i>])

Injects a variable with the given `identifier` into the given `scope` as a
`var` declaration with an optional initial value.


<a name="isReference" href="#wiki-isReference">#</a> <b>isReference</b>(<i>path</i>)

Determines whether the given `path` is a value reference. For example, `a` and
`b` are references, but `c` is not:

```js
a(b.c);
```

Only identifiers count as references.


<a name="isUsed" href="#wiki-isUsed">#</a> <b>isUsed</b>(<i>scope</i>, <i>name</i>)

Determines whether the given `name` should be considered "used" in the given
`scope`. For a name to be used, it should either:

  1. Be declared in this scope or a parent scope.
  2. Be referenced in this scope, a parent scope, or any child scopes.

For example, `a`, `b`, and `d` are used in the global scope of this example
while `c` is not:

```js
var a;
function b() {}

try {
  a = b(d);
} catch (c) {
}
```


<a name="sharedFor" href="#wiki-sharedFor">#</a> <b>sharedFor</b>(<i>scope</i>, <i>name</i>)

Injects a shared variable by getting the named value from a dotted path. For
example, this will return an identifier that can be used in place of the named
expression:

```js
sharedFor(scope, 'Object.defineProperty')
```

Subsequent calls to `sharedFor` in the same scope will return the same
identifier.


<a name="uniqueIdentifier" href="#wiki-uniqueIdentifier">#</a> <b>uniqueIdentifier</b>(<i>scope</i>[, <i>name</i>])

Generates an identifier guaranteed not to collide with any others in the given
`scope`. This function will also never generate the same identifier twice for
any `scope` whose global scope already got that identifier.

Called in a scope with no global references and no variables, the first time
this function is called it will return an identifier named `$__0`.

When called with a name that name will be used with a prefix, "$\_\_", if
possible. If that name is already used then it will append incrementing numbers
until it finds a name that isn't used.


## Usage

These methods are useful to source transforms, such as transpilers or macros.
Such transforms often have to insert variables into scopes and replace
expressions. Using `injectVariable` and `injectShared` are specifically for
that purpose. In conjunction with `ast-types`, here's how you'd write a simple
version of a `swap` macro:

```js
// var tmp;
var tmp = util.injectVariable(
  this.scope,
  util.uniqueIdentifier(this.scope)
);

this.replace(
  b.sequenceExpression([
    // tmp = left
    b.assignmentExpression(
      '=',
      tmp,
      left
    ),
    // left = right
    b.assignmentExpression(
      '=',
      left,
      right
    ),
    // right = tmp
    b.assignmentExpression(
      '=',
      right,
      tmp
    )
  ])
);
```

See [examples/swap-macro.js](examples/swap-macro.js) for a more complete
example.

## Contributing

[![Build Status](https://travis-ci.org/square/ast-util.png?branch=master)](https://travis-ci.org/square/ast-util)


### Setup

First, install the development dependencies:

```
$ npm install
```

Then, try running the tests:

```
$ npm test
```


### Pull Requests

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

Any contributors to the master ast-util repository must sign the [Individual
Contributor License Agreement (CLA)][cla].  It's a short form that covers our
bases and makes sure you're eligible to contribute.

[cla]: https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1

When you have a change you'd like to see in the master repository, [send a pull
request](https://github.com/square/ast-utils/pulls). Before we merge your
request, we'll make sure you're in the list of people who have signed a CLA.


## Acknowledgements

Huge thanks to [Ben Newman][benjamn] for [ast-types][ast-types], on which much
of this library depends.

[benjamn]: https://github.com/benjamn
[ast-types]: https://github.com/benjamn/ast-types
