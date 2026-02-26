export type TranspilerError = {
  testTitle: string;
  errors: {
    message: string;
  }[];
};

export const expectTranspilerErrors: { [fileName: string]: TranspilerError } = {
  accessNonProp: {
    testTitle: 'errors on contract `AccessNonProp`.',
    errors: [
      {
        message: "Cannot access Non-Prop property 'a' in a `@method()` function",
      },
      {
        message: "Cannot access Non-Prop property 'a' in a `@method()` function",
      },
    ],
  },

  badTypes: {
    testTitle: 'errors on contract `BadTypes`.',
    errors: [
      {
        message: 'Untransformable type `number` here, please use type `bigint` instead',
      },
      {
        message: 'Untransformable type `string` here, please use type `ByteString` instead',
      },
      {
        message: 'Untransformable type `string` here, please use type `ByteString` instead',
      },
      {
        message: 'Untransformable type `number` here, please use type `bigint` instead',
      },
      {
        message: 'Untransformable type `string` here, please use type `ByteString` instead',
      },
      {
        message: 'Untransformable type `string` here, please use type `ByteString` instead',
      },
      {
        message: "Untransformable literal object type: '{ x: 1n }'",
      },
      {
        message: "Untransformable literal object type: '{ x: bigint }'",
      },
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
      {
        message: "Untransformable type : ''hello world'', missing explicitly declared type",
      },
      {
        message:
          "Untransformable type : ''68656c6c6f20776f726c64'', missing explicitly declared type",
      },
      {
        message: 'Untransformable type `string` here, please use type `ByteString` instead',
      },
      {
        message: "Untransformable type : 'true ? 1n : 3n', missing explicitly declared type",
      },
    ],
  },
  byteStringSlice: {
    testTitle: 'errors on contract `ByteStringSlice`.',
    errors: [
      {
        message: '`b.slice(2, 4)` is not allowed here, slice ByteString is not supported',
      },
      {
        message: '`b[1]` is not allowed here, slice ByteString is not supported',
      },
    ],
  },
  callMethod: {
    testTitle: 'errors on contract `CallMethod`.',
    errors: [
      {
        message: '`bar` is not `@method` decorated so cannot be called in `world`.',
      },
    ],
  },

  constructor1: {
    testTitle: 'errors on contract `Constructor1`.',
    errors: [
      {
        message: 'All parameters in the constructor must be passed to the `super()` call',
      },
    ],
  },
  constructor2: {
    testTitle: 'errors on contract `Constructor2`.',
    errors: [
      {
        message:
          'All parameters in the constructor must be passed to the `super()` call following their declaration order',
      },
    ],
  },
  contractLib1: {
    testTitle: 'errors on contract `ContractLibWrapper1`.',
    errors: [
      {
        message: '`@method` in `SmartContractLib` should not be declared as `public`',
      },
    ],
  },
  contractLib2: {
    testTitle: 'errors on contract `ContractLib2`.',
    errors: [
      {
        message:
          "Untransformable parameter: '@method()\n" +
          '  static myCheckPreimage(txPreimage: SHPreimage, contractCtx: SmartContract): boolean {\n' +
          '    return contractCtx.checkSHPreimage(txPreimage);\n' +
          "  }'",
      },
    ],
  },

  counter4: {
    testTitle: 'errors on contract `Counter4`.',
    errors: [
      {
        message:
          'State type of the contract `Counter4` should be a TypeReference instead of a TypeLiteral',
      },
    ],
  },
  ctc: {
    testTitle: 'errors on contract `Ctc`.',
    errors: [
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
      {
        message: 'Untransformable type `Array`, please use type `FixedArray` instead',
      },
    ],
  },
  ctx: {
    testTitle: 'errors on contract `InvalidCTX`.',
    errors: [
      {
        message: '`IContext` is not allowed to be defined in the contract',
      },
    ],
  },
  ctx1: {
    testTitle: 'errors on contract `InvalidCTX1`.',
    errors: [
      {
        message:
          'Cannot access `this.ctx`, `this.state`, `this.changeInfo`, or `backtrace` in a private method `foo`, because the private method is not called by any public method',
      },
    ],
  },

  // demo, demobase is valid, no expect errors

  enum: {
    testTitle: 'errors on contract `InvalidEnumC`.',
    errors: [
      {
        message:
          "Untransformable enum member: 'EnumExample.TWO', only allowed number literal in enum",
      },
    ],
  },
  explicitReturn: {
    testTitle: 'errors on contract `ExplicitReturn`.',
    errors: [
      {
        message: 'public methods cannot contain an explicit return statement',
      },
    ],
  },
  explicitReturn2: {
    testTitle: 'errors on contract `ExplicitReturn2`.',
    errors: [
      {
        message: 'public methods cannot contain an explicit return statement',
      },
    ],
  },
  forLoop: {
    testTitle: 'errors on contract `ForLoop`.',
    errors: [
      {
        message:
          "`for` statement in `@method` should have induction variable declaration as: 'for(let $i = 0; ...; ...)'",
      },
      {
        message:
          "`for` statement in `@method` should have condition expression as: 'for(...; $i < $constNum; ...)'",
      },
      {
        message:
          "`for` statement in `@method` should have incrementor expression as: 'for(...; ...; $i++)'",
      },
    ],
  },

  heritageDemoInvalid3: {
    testTitle: 'errors on contract `HeritageDemoInvalid3`.',
    errors: [
      {
        message: 'A `SmartContract` should have at least one public `@method`',
      },
    ],
  },
  heritageDemoInvalid4: {
    testTitle: 'errors on contract `HeritageDemoInvalid4`.',
    errors: [
      {
        message: "Untransformable property: 'x', already defined in base contract 'DemoBase'",
      },
    ],
  },

  invalidB2G: {
    testTitle: 'errors on contract `InvalidB2G`.',
    errors: [
      {
        message:
          '`unlock1` cannot call public function `toOutputpint`, because public function `toOutputpint` has access to `this.ctx`, `this.state`, `this.changeInfo`, or `backtrace`',
      },
    ],
  },

  invalidCtx2: {
    testTitle: 'errors on contract `InvalidCtx2`.',
    errors: [
      {
        message:
          '`unlock` cannot call public function `f1`, because public function `f1` has access to `this.ctx`, `this.state`, `this.changeInfo`, or `backtrace`',
      },
    ],
  },

  invalidFillFixedArray: {
    testTitle: 'errors on contract `InvalidFillFixedArray`.',
    errors: [
      {
        message: 'Only compiled-time constant can be passed to the second parameter of `fill`',
      },
    ],
  },

  invalidState: {
    testTitle: 'errors on contract `InvalidState`.',
    errors: [
      {
        message:
          '`increase` cannot call public function `f1`, because public function `f1` has access to `this.ctx`, `this.state`, `this.changeInfo`, or `backtrace`',
      },
    ],
  },

  issue292: {
    testTitle: 'errors on contract `Issue292`.',
    errors: [
      {
        message:
          'contract `Demo` can not be initialized inside a @method, only supports instantiation of library',
      },
    ],
  },
  nonPublicMethod2: {
    testTitle: 'errors on contract `NonPublicMethod2`.',
    errors: [
      {
        message: 'non-public methods must declare the return type explicitly',
      },
      {
        message: 'non-public methods must declare the return type explicitly',
      },
    ],
  },
  // todo: add test when OCS is ready
  // 'OCS1': {
  //     testTitle: 'errors on contract `OCS1`.',
  //     errors: [
  //         {
  //             message: 'non-public methods cannot call insertCodeSeparator()',
  //         },
  //     ],
  // },
  // 'OCS2': {
  //     testTitle: 'errors on contract `OCS2`.',
  //     errors: [
  //         {
  //             message: 'insertCodeSeparator() cannot be called in a if statement',
  //         },
  //     ],
  // },
  // 'OCS3': {
  //     testTitle: 'errors on contract `OCS3`.',
  //     errors: [
  //         {
  //             message: 'insertCodeSeparator() can only be called by one pulic method',
  //         },
  //     ],
  // },
  operatorRequiresBoolean: {
    testTitle: 'errors on contract `OperatorRequiresBoolean`.',
    errors: [
      {
        message: '`a && t` is not allowed, both operands of `&&` must be boolean type',
      },
      {
        message: '`a && a` is not allowed, both operands of `&&` must be boolean type',
      },
      {
        message: '`a || a` is not allowed, both operands of `||` must be boolean type',
      },
      {
        message: '`!a` is not allowed, operand of `!` must be boolean type',
      },
    ],
  },

  propInitialization1: {
    testTitle: 'errors on contract `PropInitialization1`.',
    errors: [
      {
        message: 'property `a` must be initialized in the constructor',
      },
    ],
  },
  propInitialization2: {
    testTitle: 'errors on contract `PropInitialization2`.',
    errors: [
      {
        message:
          "Untransformable property: 'a', Non-static properties shall only be initialized in the constructor",
      },
    ],
  },
  publicMethod1: {
    testTitle: 'errors on contract `PublicMethod1`.',
    errors: [
      {
        message: 'A `SmartContract` should have at least one public `@method`',
      },
    ],
  },
  publicMethod2: {
    testTitle: 'errors on contract `PublicMethod2`.',
    errors: [
      {
        message: 'Untransformable public method: Public method `foo` not ended with `assert()`',
      },
      {
        message: 'public methods cannot contain an explicit return statement',
      },
    ],
  },
  recursion: {
    testTitle: 'errors on contract `Recursion`.',
    errors: [
      {
        message: 'Cycle detected in function call: this.factorial()!',
      },
    ],
  },
  recursion2: {
    testTitle: 'errors on contract `Recursion2`.',
    errors: [
      {
        message: 'Cycle detected in function call: this.c()!',
      },
    ],
  },
  sigHashChange: {
    testTitle: 'should throw when calling `buildChangeOutput` on sighash SINGLE | NONE method.',
    errors: [
      {
        message: `Can only use sighash ALL or ANYONECANPAY_ALL if using \`this.buildChangeOutput()\``,
      },
    ],
  },

  staticProp: {
    testTitle: 'should throw when static invalid',
    errors: [
      {
        message:
          "Untransformable property: 'a', static property shall be initialized when declared",
      },
      {
        message: "Untransformable property: 'a1', all `prop()` should be typed explicitly",
      },
      {
        message: "Untransformable property: 'a2', all `prop()` should be typed explicitly",
      },
      {
        message:
          "Untransformable property: 'b', static property shall be initialized when declared",
      },
      {
        message:
          "Untransformable property: 'c', static property shall be initialized when declared",
      },
      {
        message:
          "Untransformable property: 'c1', static property shall be initialized when declared",
      },
      {
        message: "Untransformable property: 'e2', all `prop()` should be typed explicitly",
      },
      {
        message: "Cannot access Non-Prop property 'f1' in a `@method()` function",
      },
    ],
  },
  stringLiteral: {
    testTitle: 'errors on contract `StringLiteral`.',
    errors: [
      {
        message: 'invalid PubKey length, expect a ByteString with 33 bytes',
      },
      {
        message: 'invalid Ripemd160 length, expect a ByteString with 20 bytes',
      },
      {
        message: 'invalid PubKeyHash length, expect a ByteString with 20 bytes',
      },
      {
        message: 'invalid Sha256 length, expect a ByteString with 32 bytes',
      },
      {
        message: '<ed1b8d80793e70c0608e508a8dd80f6aa56f9> should have even length',
      },
      {
        message: 'invalid OpCodeType length, expect a OpCodeType with 1 bytes',
      },
      {
        message: 'invalid Addr length, expect a ByteString with 20 bytes',
      },
      {
        message: 'invalid Sig length, expect a Sig with (71 || 72 || 73) bytes',
      },
      {
        message: 'invalid Sha1 length, expect a ByteString with 20 bytes',
      },
      {
        message: "String literal '00' is not allowed here, please use `toByteString` instead",
      },
    ],
  },
  toByteString: {
    testTitle: 'errors on contract `ToByteString`.',
    errors: [
      {
        message: 'Only boolean literal can be passed to the second parameter of `toByteString`',
      },
      {
        message: 'Only boolean literal can be passed to the second parameter of `toByteString`',
      },
      {
        message: '`001` is not a valid hex literal',
      },
      {
        message: '`hello` is not a valid hex literal',
      },
    ],
  },

  typeNospecified: {
    testTitle: 'errors on contract `TypeNonspecified`.',
    errors: [
      {
        message: "Untransformable parameter: 'a', all parameters should be typed explicitly",
      },
      {
        message: "Untransformable parameter: 'b', all parameters should be typed explicitly",
      },
    ],
  },
};
