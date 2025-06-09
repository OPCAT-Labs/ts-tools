import { OpCodeType } from './primitives.js';
/**
 * This is a list of all Script words, also known as opcodes, commands, or functions.
 * Opcodes used in [BTC Script]{@link https://en.bitcoin.it/wiki/Script}
 * @category Library
 * @onchain
 */
export class OpCode {
  /**
   * An empty array of bytes is pushed onto the stack. (This is not a no-op: an item is added to the stack.)
   * @name OP_0
   * @constant {OpCodeType} `OpCodeType('00')`
   */
  static readonly OP_0: OpCodeType = OpCodeType('00');
  /**
   * An empty array of bytes is pushed onto the stack. (This is not a no-op: an item is added to the stack.)
   * @name OP_FALSE
   * @constant {OpCodeType} `OpCodeType('00')`
   */
  static readonly OP_FALSE: OpCodeType = OpCodeType('00');
  /**
   * The next byte contains the number of bytes to be pushed onto the stack.
   * @name OP_PUSHDATA1
   * @constant {OpCodeType} `OpCodeType('4c')`
   */
  static readonly OP_PUSHDATA1: OpCodeType = OpCodeType('4c');
  /**
   * The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
   * @name OP_PUSHDATA2
   * @constant {OpCodeType} `OpCodeType('4d')`
   */
  static readonly OP_PUSHDATA2: OpCodeType = OpCodeType('4d');
  /**
   * The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
   * @name OP_PUSHDATA4
   * @constant {OpCodeType} `OpCodeType('4e')`
   */
  static readonly OP_PUSHDATA4: OpCodeType = OpCodeType('4e');
  /**
   * The number -1 is pushed onto the stack.
   * @name OP_1NEGATE
   * @constant {OpCodeType} `OpCodeType('4f')`
   */
  static readonly OP_1NEGATE: OpCodeType = OpCodeType('4f');
  /**
   * Transaction is invalid unless occuring in an unexecuted OP_IF branch
   * @name OP_RESERVED
   * @constant {OpCodeType} `OpCodeType('50')`
   */
  static readonly OP_RESERVED: OpCodeType = OpCodeType('50');
  /**
   * The number 1 is pushed onto the stack.
   * @name OP_1
   * @constant {OpCodeType} `OpCodeType('51')`
   */
  static readonly OP_1: OpCodeType = OpCodeType('51');
  /**
   * The number 1 is pushed onto the stack.
   * @name OP_TRUE
   * @constant {OpCodeType} `OpCodeType('51')`
   */
  static readonly OP_TRUE: OpCodeType = OpCodeType('51');
  /**
   * The number 2 is pushed onto the stack.
   * @name OP_2
   * @constant {OpCodeType} `OpCodeType('52')`
   */
  static readonly OP_2: OpCodeType = OpCodeType('52');
  /**
   * The number 3 is pushed onto the stack.
   * @name OP_3
   * @constant {OpCodeType} `OpCodeType('53')`
   */
  static readonly OP_3: OpCodeType = OpCodeType('53');
  /**
   * The number 4 is pushed onto the stack.
   * @name OP_4
   * @constant {OpCodeType} `OpCodeType('54')`
   */
  static readonly OP_4: OpCodeType = OpCodeType('54');
  /**
   * The number 5 is pushed onto the stack.
   * @name OP_5
   * @constant {OpCodeType} `OpCodeType('55')`
   */
  static readonly OP_5: OpCodeType = OpCodeType('55');
  /**
   * The number 6 is pushed onto the stack.
   * @name OP_6
   * @constant {OpCodeType} `OpCodeType('56')`
   */
  static readonly OP_6: OpCodeType = OpCodeType('56');
  /**
   * The number 7 is pushed onto the stack.
   * @name OP_7
   * @constant {OpCodeType} `OpCodeType('57')`
   */
  static readonly OP_7: OpCodeType = OpCodeType('57');
  /**
   * The number 8 is pushed onto the stack.
   * @name OP_8
   * @constant {OpCodeType} `OpCodeType('58')`
   */
  static readonly OP_8: OpCodeType = OpCodeType('58');
  /**
   * The number 9 is pushed onto the stack.
   * @name OP_9
   * @constant {OpCodeType} `OpCodeType('59')`
   */
  static readonly OP_9: OpCodeType = OpCodeType('59');
  /**
   * The number 10 is pushed onto the stack.
   * @name OP_10
   * @constant {OpCodeType} `OpCodeType('5a')`
   */
  static readonly OP_10: OpCodeType = OpCodeType('5a');
  /**
   * The number 11 is pushed onto the stack.
   * @name OP_11
   * @constant {OpCodeType} `OpCodeType('5b')`
   */
  static readonly OP_11: OpCodeType = OpCodeType('5b');
  /**
   * The number 12 is pushed onto the stack.
   * @name OP_12
   * @constant {OpCodeType} `OpCodeType('5c')`
   */
  static readonly OP_12: OpCodeType = OpCodeType('5c');
  /**
   * The number 13 is pushed onto the stack.
   * @name OP_13
   * @constant {OpCodeType} `OpCodeType('5d')`
   */
  static readonly OP_13: OpCodeType = OpCodeType('5d');
  /**
   * The number 14 is pushed onto the stack.
   * @name OP_14
   * @constant {OpCodeType} `OpCodeType('5e')`
   */
  static readonly OP_14: OpCodeType = OpCodeType('5e');
  /**
   * The number 15 is pushed onto the stack.
   * @name OP_15
   * @constant {OpCodeType} `OpCodeType('5f')`
   */
  static readonly OP_15: OpCodeType = OpCodeType('5f');
  /**
   * The number 16 is pushed onto the stack.
   * @name OP_16
   * @constant {OpCodeType} `OpCodeType('60')`
   */
  static readonly OP_16: OpCodeType = OpCodeType('60');

  /**
   * Does nothing.
   * @name OP_NOP
   * @constant {OpCodeType} `OpCodeType('61')`
   */
  static readonly OP_NOP: OpCodeType = OpCodeType('61');
  /**
   * Puts the version of the protocol under which this transaction will be evaluated onto the stack.
   * @deprecated DISABLED
   * @name OP_VER
   * @constant {OpCodeType} `OpCodeType('62')`
   */
  static readonly OP_VER: OpCodeType = OpCodeType('62');
  /**
   * If the top stack value is TRUE, statement 1 is executed.
   * If the top stack value is FALSE and ELSE is used, statement 2 is executed.
   * If ELSE is NOT used, the script jumps to ENDIF. The top stack value is removed.
   * @name OP_IF
   * @constant {OpCodeType} `OpCodeType('63')`
   * @example
   * `[expression] IF
   *  [statement 1]
   * ENDIF`
   * OR
   * `[expression] IF
   *  [statement 1]
   * ELSE
   *  [statement 2]
   * ENDIF`
   */
  static readonly OP_IF: OpCodeType = OpCodeType('63');
  /**
   * If the top stack value is FALSE, statement 1 is executed.
   * If the top stack value is TRUE and ELSE is used, statement 2 is executed. If ELSE is NOT used, the script jumps to ENDIF.
   * The top stack value is removed.
   * @deprecated
   * @name OP_NOTIF
   * @constant {OpCodeType} `OpCodeType('64')`
   * @example
   * `[expression] NOTIF
   *  [statement 1]
   * ENDIF`
   * OR
   * `[expression] NOTIF
   *  [statement 1]
   * ELSE
   *  [statement 2]
   * ENDIF`
   */
  static readonly OP_NOTIF: OpCodeType = OpCodeType('64');
  /**
   * @name OP_VERIF
   * @constant {OpCodeType} `OpCodeType('65')`
   * @deprecated DISABLED
   */
  static readonly OP_VERIF: OpCodeType = OpCodeType('65');
  /**
   * @name OP_VERNOTIF
   * @constant {OpCodeType} `OpCodeType('66')`
   * @deprecated DISABLED
   */
  static readonly OP_VERNOTIF: OpCodeType = OpCodeType('66');
  /**
   * If the preceding IF or NOTIF check was not valid then statement 2 is executed.
   * @name OP_ELSE
   * @constant {OpCodeType} `OpCodeType('67')`
   * @example
   * `[expression] IF
   *  [statement 1]
   * ELSE
   *  [statement 2]
   * ENDIF`
   */
  static readonly OP_ELSE: OpCodeType = OpCodeType('67');
  /**
   * Ends an if/else block. All blocks must end, or the transaction is invalid.
   * An OP_ENDIF without a prior matching OP_IF or OP_NOTIF is also invalid.
   * @name OP_ENDIF
   * @constant {OpCodeType} `OpCodeType('68')`
   * @example
   * `[expression] IF
   *  [statement 1]
   * ELSE
   *  [statement 2]
   * ENDIF`
   */
  static readonly OP_ENDIF: OpCodeType = OpCodeType('68');
  /**
   * Marks transaction as invalid if top stack value is not true. The top stack value is removed.
   * @name OP_VERIFY
   * @constant {OpCodeType} `OpCodeType('69')`
   */
  static readonly OP_VERIFY: OpCodeType = OpCodeType('69');
  /**
   * OP_RETURN can also be used to create "False Return" outputs with a scriptPubKey consisting of `OP_FALSE` `OP_RETURN` followed by data. Such outputs are provably unspendable and should be given a value of zero Satoshis. These outputs can be pruned from storage in the UTXO set, reducing its size. Currently the BitcoinSV network supports multiple FALSE RETURN outputs in a given transaction with each one capable of holding up to 100kB of data. After the Genesis upgrade in 2020 miners will be free to mine transactions containing FALSE RETURN outputs of any size.
   * @name OP_RETURN
   * @constant {OpCodeType} `OpCodeType('6a')`
   */
  static readonly OP_RETURN: OpCodeType = OpCodeType('6a');

  /**
   * Puts the input onto the top of the alt stack. Removes it from the main stack.
   * @name OP_TOALTSTACK
   * @constant {OpCodeType} `OpCodeType('6b')`
   */
  static readonly OP_TOALTSTACK: OpCodeType = OpCodeType('6b');
  /**
   * Puts the input onto the top of the main stack. Removes it from the alt stack.
   * @name OP_FROMALTSTACK
   * @constant {OpCodeType} `OpCodeType('6c')`
   */
  static readonly OP_FROMALTSTACK: OpCodeType = OpCodeType('6c');
  /**
   * Removes the top two stack items.
   * @name OP_2DROP
   * @constant {OpCodeType} `OpCodeType('6d')`
   */
  static readonly OP_2DROP: OpCodeType = OpCodeType('6d');
  /**
   * Duplicates the top two stack items.
   * @name OP_2DUP
   * @constant {OpCodeType} `OpCodeType('6e')`
   */
  static readonly OP_2DUP: OpCodeType = OpCodeType('6e');
  /**
   * Duplicates the top three stack items.
   * @name OP_3DUP
   * @constant {OpCodeType} `OpCodeType('6f')`
   */
  static readonly OP_3DUP: OpCodeType = OpCodeType('6f');
  /**
   * Copies the pair of items two spaces back in the stack to the front.
   * @name OP_2OVER
   * @constant {OpCodeType} `OpCodeType('70')`
   */
  static readonly OP_2OVER: OpCodeType = OpCodeType('70');
  /**
   * The fifth and sixth items back are moved to the top of the stack.
   * @name OP_2ROT
   * @constant {OpCodeType} `OpCodeType('71')`
   */
  static readonly OP_2ROT: OpCodeType = OpCodeType('71');
  /**
   * Swaps the top two pairs of items.
   * @name OP_2SWAP
   * @constant {OpCodeType} `OpCodeType('72')`
   */
  static readonly OP_2SWAP: OpCodeType = OpCodeType('72');
  /**
   * If the top stack value is not 0, duplicate it.
   * @name OP_IFDUP
   * @constant {OpCodeType} `OpCodeType('73')`
   */
  static readonly OP_IFDUP: OpCodeType = OpCodeType('73');
  /**
   * Counts the number of stack items onto the stack and places the value on the top
   * @name OP_DEPTH
   * @constant {OpCodeType} `OpCodeType('74')`
   */
  static readonly OP_DEPTH: OpCodeType = OpCodeType('74');
  /**
   * Removes the top stack item.
   * @name OP_DROP
   * @constant {OpCodeType} `OpCodeType('75')`
   */
  static readonly OP_DROP: OpCodeType = OpCodeType('75');
  /**
   * Duplicates the top stack item.
   * @name OP_DUP
   * @constant {OpCodeType} `OpCodeType('76')`
   */
  static readonly OP_DUP: OpCodeType = OpCodeType('76');
  /**
   * Removes the second-to-top stack item.
   * @name OP_NIP
   * @constant {OpCodeType} `OpCodeType('77')`
   */
  static readonly OP_NIP: OpCodeType = OpCodeType('77');
  /**
   * Copies the second-to-top stack item to the top.
   * @name OP_OVER
   * @constant {OpCodeType} `OpCodeType('78')`
   */
  static readonly OP_OVER: OpCodeType = OpCodeType('78');
  /**
   * The item `n` back in the stack is copied to the top.
   * @name OP_PICK
   * @constant {OpCodeType} `OpCodeType('79')`
   */
  static readonly OP_PICK: OpCodeType = OpCodeType('79');
  /**
   * The item `n` back in the stack is moved to the top.
   * @name OP_ROLL
   * @constant {OpCodeType} `OpCodeType('7a')`
   */
  static readonly OP_ROLL: OpCodeType = OpCodeType('7a');
  /**
   * The top three items on the stack are rotated to the left.
   * @name OP_ROT
   * @constant {OpCodeType} `OpCodeType('7b')`
   */
  static readonly OP_ROT: OpCodeType = OpCodeType('7b');
  /**
   * The top two items on the stack are swapped.
   * @name OP_SWAP
   * @constant {OpCodeType} `OpCodeType('7c')`
   */
  static readonly OP_SWAP: OpCodeType = OpCodeType('7c');
  /**
   * The item at the top of the stack is copied and inserted before the second-to-top item.
   * @name OP_TUCK
   * @constant {OpCodeType} `OpCodeType('7d')`
   */
  static readonly OP_TUCK: OpCodeType = OpCodeType('7d');

  /**
   * Concatenates two strings.
   * @name OP_CAT
   * @constant {OpCodeType} `OpCodeType('7e')`
   */
  static readonly OP_CAT: OpCodeType = OpCodeType('7e');
  /**
   * Splits byte sequence x at position n.
   * @name OP_SPLIT
   * @constant {OpCodeType} `OpCodeType('7f')`
   */
  static readonly OP_SPLIT: OpCodeType = OpCodeType('7f'); // after monolith upgrade (May 2018)
  /**
   * Converts numeric value a into byte sequence of length b.
   * @name OP_NUM2BIN
   * @constant {OpCodeType} `OpCodeType('80')`
   */
  static readonly OP_NUM2BIN: OpCodeType = OpCodeType('80'); // after monolith upgrade (May 2018)
  /**
   * Converts byte sequence x into a numeric value.
   * @name OP_BIN2NUM
   * @constant {OpCodeType} `OpCodeType('81')`
   */
  static readonly OP_BIN2NUM: OpCodeType = OpCodeType('81'); // after monolith upgrade (May 2018)
  /**
   * Pushes the string length of the top element of the stack (without popping it).
   * @name OP_SIZE
   * @constant {OpCodeType} `OpCodeType('82')`
   */
  static readonly OP_SIZE: OpCodeType = OpCodeType('82');

  /**
   * Flips all of the bits in the input.
   * @name OP_INVERT
   * @constant {OpCodeType} `OpCodeType('83')`
   */
  static readonly OP_INVERT: OpCodeType = OpCodeType('83');
  /**
   * Boolean and between each bit in the inputs.
   * @name OP_AND
   * @constant {OpCodeType} `OpCodeType('84')`
   */
  static readonly OP_AND: OpCodeType = OpCodeType('84');
  /**
   * Boolean or between each bit in the inputs.
   * @name OP_OR
   * @constant {OpCodeType} `OpCodeType('85')`
   */
  static readonly OP_OR: OpCodeType = OpCodeType('85');
  /**
   * Boolean exclusive or between each bit in the inputs.
   * @name OP_XOR
   * @constant {OpCodeType} `OpCodeType('86')`
   */
  static readonly OP_XOR: OpCodeType = OpCodeType('86');
  /**
   * Returns 1 if the inputs are exactly equal, 0 otherwise.
   * @name OP_EQUAL
   * @constant {OpCodeType} `OpCodeType('87')`
   */
  static readonly OP_EQUAL: OpCodeType = OpCodeType('87');
  /**
   * Same as `OP_EQUAL`, but runs `OP_VERIFY` afterward.
   * @name OP_EQUALVERIFY
   * @constant {OpCodeType} `OpCodeType('88')`
   */
  static readonly OP_EQUALVERIFY: OpCodeType = OpCodeType('88');
  /**
   * Any opcode not assigned is also reserved. Using an unassigned opcode makes the transaction invalid.
   * @name OP_RESERVED1
   * @constant {OpCodeType} `OpCodeType('89')`
   */
  static readonly OP_RESERVED1: OpCodeType = OpCodeType('89');
  /**
   * Any opcode not assigned is also reserved. Using an unassigned opcode makes the transaction invalid.
   * @name OP_RESERVED2
   * @constant {OpCodeType} `OpCodeType('8a')`
   */
  static readonly OP_RESERVED2: OpCodeType = OpCodeType('8a');

  /**
   * 1 is added to the input.
   * @name OP_1ADD
   * @constant {OpCodeType} `OpCodeType('8b')`
   */
  static readonly OP_1ADD: OpCodeType = OpCodeType('8b');
  /**
   * 1 is subtracted from the input.
   * @name OP_1SUB
   * @constant {OpCodeType} `OpCodeType('8c')`
   */
  static readonly OP_1SUB: OpCodeType = OpCodeType('8c');
  /**
   * The input is multiplied by 2. **DISABLED** now. (This opcode is scheduled to be re-enabled in the Chronicle update)
   * @name OP_2MUL
   * @constant {OpCodeType} `OpCodeType('8d')`
   */
  static readonly OP_2MUL: OpCodeType = OpCodeType('8d');
  /**
   * The input is divided by 2. **DISABLED** now. (This opcode is scheduled to be re-enabled in the Chronicle update)
   * @name OP_2DIV
   * @constant {OpCodeType} `OpCodeType('8e')`
   */
  static readonly OP_2DIV: OpCodeType = OpCodeType('8e');
  /**
   * The sign of the input is flipped.
   * @name OP_NEGATE
   * @constant {OpCodeType} `OpCodeType('8f')`
   */
  static readonly OP_NEGATE: OpCodeType = OpCodeType('8f');
  /**
   * The input is made positive.
   * @name OP_ABS
   * @constant {OpCodeType} `OpCodeType('90')`
   */
  static readonly OP_ABS: OpCodeType = OpCodeType('90');
  /**
   * If the input is 0 or 1, it is flipped. Otherwise the output will be 0.
   * @name OP_NOT
   * @constant {OpCodeType} `OpCodeType('91')`
   */
  static readonly OP_NOT: OpCodeType = OpCodeType('91');
  /**
   * Returns 0 if the input is 0. 1 otherwise.
   * @name OP_0NOTEQUAL
   * @constant {OpCodeType} `OpCodeType('92')`
   */
  static readonly OP_0NOTEQUAL: OpCodeType = OpCodeType('92');
  /**
   * a is added to b.
   * @name OP_ADD
   * @constant {OpCodeType} `OpCodeType('93')`
   */
  static readonly OP_ADD: OpCodeType = OpCodeType('93');
  /**
   * b is subtracted from a.
   * @name OP_SUB
   * @constant {OpCodeType} `OpCodeType('94')`
   */
  static readonly OP_SUB: OpCodeType = OpCodeType('94');
  /**
   * a is multiplied by b.
   * @name OP_MUL
   * @constant {OpCodeType} `OpCodeType('95')`
   */
  static readonly OP_MUL: OpCodeType = OpCodeType('95');
  /**
   * a is divided by b.
   * @name OP_DIV
   * @constant {OpCodeType} `OpCodeType('96')`
   */
  static readonly OP_DIV: OpCodeType = OpCodeType('96');
  /**
   * Returns the remainder after dividing a by b.
   * @name OP_MOD
   * @constant {OpCodeType} `OpCodeType('97')`
   */
  static readonly OP_MOD: OpCodeType = OpCodeType('97');
  /**
   * Logical left shift b bits. Sign data is discarded
   * @name OP_LSHIFT
   * @constant {OpCodeType} `OpCodeType('98')`
   */
  static readonly OP_LSHIFT: OpCodeType = OpCodeType('98');
  /**
   * Logical right shift b bits. Sign data is discarded
   * @name OP_RSHIFT
   * @constant {OpCodeType} `OpCodeType('99')`
   */
  static readonly OP_RSHIFT: OpCodeType = OpCodeType('99');
  /**
   * If both a and b are not 0, the output is 1. Otherwise 0.
   * @name OP_BOOLAND
   * @constant {OpCodeType} `OpCodeType('9a')`
   */
  static readonly OP_BOOLAND: OpCodeType = OpCodeType('9a');
  /**
   * If a or b is not 0, the output is 1. Otherwise 0.
   * @name OP_BOOLOR
   * @constant {OpCodeType} `OpCodeType('9b')`
   */
  static readonly OP_BOOLOR: OpCodeType = OpCodeType('9b');
  /**
   * Returns 1 if the numbers are equal, 0 otherwise.
   * @name OP_NUMEQUAL
   * @constant {OpCodeType} `OpCodeType('9c')`
   */
  static readonly OP_NUMEQUAL: OpCodeType = OpCodeType('9c');
  /**
   * Same as `OP_NUMEQUAL`, but runs `OP_VERIFY` afterward.
   * @name OP_NUMEQUALVERIFY
   * @constant {OpCodeType} `OpCodeType('9d')`
   */
  static readonly OP_NUMEQUALVERIFY: OpCodeType = OpCodeType('9d');
  /**
   * Returns 1 if the numbers are not equal, 0 otherwise.
   * @name OP_NUMNOTEQUAL
   * @constant {OpCodeType} `OpCodeType('9e')`
   */
  static readonly OP_NUMNOTEQUAL: OpCodeType = OpCodeType('9e');
  /**
   * Returns 1 if a is less than b, 0 otherwise.
   * @name OP_LESSTHAN
   * @constant {OpCodeType} `OpCodeType('9f')`
   */
  static readonly OP_LESSTHAN: OpCodeType = OpCodeType('9f');
  /**
   * Returns 1 if a is greater than b, 0 otherwise.
   * @name OP_GREATERTHAN
   * @constant {OpCodeType} `OpCodeType('a0')`
   */
  static readonly OP_GREATERTHAN: OpCodeType = OpCodeType('a0');
  /**
   * Returns 1 if a is less than or equal to b, 0 otherwise.
   * @name OP_LESSTHANOREQUAL
   * @constant {OpCodeType} `OpCodeType('a1')`
   */
  static readonly OP_LESSTHANOREQUAL: OpCodeType = OpCodeType('a1');
  /**
   * Returns 1 if a is greater than or equal to b, 0 otherwise.
   * @name OP_GREATERTHANOREQUAL
   * @constant {OpCodeType} `OpCodeType('a2')`
   */
  static readonly OP_GREATERTHANOREQUAL: OpCodeType = OpCodeType('a2');
  /**
   * Returns the smaller of a and b.
   * @name OP_MIN
   * @constant {OpCodeType} `OpCodeType('a3')`
   */
  static readonly OP_MIN: OpCodeType = OpCodeType('a3');
  /**
   * Returns the larger of a and b.
   * @name OP_MAX
   * @constant {OpCodeType} `OpCodeType('a4')`
   */
  static readonly OP_MAX: OpCodeType = OpCodeType('a4');
  /**
   * Returns 1 if x is within the specified range (left-inclusive), 0 otherwise.
   * @name OP_WITHIN
   * @constant {OpCodeType} `OpCodeType('a5')`
   */
  static readonly OP_WITHIN: OpCodeType = OpCodeType('a5');

  /**
   * The input is hashed using RIPEMD-160.
   * @name OP_RIPEMD160
   * @constant {OpCodeType} `OpCodeType('a6')`
   */
  static readonly OP_RIPEMD160: OpCodeType = OpCodeType('a6');
  /**
   * The input is hashed using SHA-1.
   * @name OP_SHA1
   * @constant {OpCodeType} `OpCodeType('a7')`
   */
  static readonly OP_SHA1: OpCodeType = OpCodeType('a7');
  /**
   * The input is hashed using SHA-256.
   * @name OP_SHA256
   * @constant {OpCodeType} `OpCodeType('a8')`
   */
  static readonly OP_SHA256: OpCodeType = OpCodeType('a8');
  /**
   * The input is hashed twice: first with SHA-256 and then with RIPEMD-160.
   * @name OP_HASH160
   * @constant {OpCodeType} `OpCodeType('a9')`
   */
  static readonly OP_HASH160: OpCodeType = OpCodeType('a9');
  /**
   * The input is hashed two times with SHA-256.
   * @name OP_HASH256
   * @constant {OpCodeType} `OpCodeType('aa')`
   */
  static readonly OP_HASH256: OpCodeType = OpCodeType('aa');
  /**
   * All of the signature checking words will only match signatures to the data after the most recently-executed
   * [OP_CODESEPARATOR]{@link https://en.bitcoin.it/wiki/Script#:~:text=with%20SHA%2D256.-,OP_CODESEPARATOR,-171}.
   * @name OP_CODESEPARATOR
   * @constant {OpCodeType} `OpCodeType('ab')`
   */
  static readonly OP_CODESEPARATOR: OpCodeType = OpCodeType('ab');
  /**
   * The entire transaction's outputs, inputs, and script (from the most recently-executed [OP_CODESEPARATOR]{@link https://en.bitcoin.it/wiki/Script#:~:text=with%20SHA%2D256.-,OP_CODESEPARATOR,-171} to the end) are hashed.
   * The signature used by [OP_CHECKSIG]{@link https://en.bitcoin.it/wiki/OP_CHECKSIG} must be a valid signature for this hash and public key. If it is, 1 is returned, 0 otherwise.
   * @name OP_CHECKSIG
   * @constant {OpCodeType} `OpCodeType('ac')`
   */
  static readonly OP_CHECKSIG: OpCodeType = OpCodeType('ac');
  /**
   * Same as `OP_CHECKSIG`, but `OP_VERIFY` is executed afterward.
   * @name OP_CHECKSIGVERIFY
   * @constant {OpCodeType} `OpCodeType('ad')`
   */
  static readonly OP_CHECKSIGVERIFY: OpCodeType = OpCodeType('ad');
  /**
   * 	Compares the first signature against each public key until it finds an ECDSA match. Starting with the subsequent public key, it compares the second signature against each remaining public key until it finds an ECDSA match. The process is repeated until all signatures have been checked or not enough public keys remain to produce a successful result. All signatures need to match a public key. Because public keys are not checked again if they fail any signature comparison, signatures must be placed in the scriptSig using the same order as their corresponding public keys were placed in the scriptPubKey or redeemScript. If all signatures are valid, 1 is returned, 0 otherwise. Due to a bug, an extra unused value (x) is removed from the stack. Script spenders must account for this by adding a junk value (typically zero) to the stack.
   * @name OP_CHECKMULTISIG
   * @constant {OpCodeType} `OpCodeType('ae')`
   */
  static readonly OP_CHECKMULTISIG: OpCodeType = OpCodeType('ae');
  /**
   * Same as `OP_CHECKMULTISIG`, but `OP_VERIFY` is executed afterward.
   * @name OP_CHECKMULTISIGVERIFY
   * @constant {OpCodeType} `OpCodeType('af')`
   */
  static readonly OP_CHECKMULTISIGVERIFY: OpCodeType = OpCodeType('af');

  /**
   * No operation. The word is ignored.
   * @name OP_NOP1
   * @constant {OpCodeType} `OpCodeType('b0')`
   */
  static readonly OP_NOP1: OpCodeType = OpCodeType('b0');
  /**
   * No operation. The word is ignored. (previously OP_CHECKLOCKTIMEVERIFY)
   * @name OP_NOP2
   * @constant {OpCodeType} `OpCodeType('b1')`
   */
  static readonly OP_NOP2: OpCodeType = OpCodeType('b1'); // previously OP_CHECKLOCKTIMEVERIFY
  /**
   * No operation. The word is ignored. (previously OP_CHECKSEQUENCEVERIFY)
   * @name OP_NOP3
   * @constant {OpCodeType} `OpCodeType('b2')`
   */
  static readonly OP_NOP3: OpCodeType = OpCodeType('b2');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP4
   * @constant {OpCodeType} `OpCodeType('b3')`
   */
  static readonly OP_NOP4: OpCodeType = OpCodeType('b3');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP5
   * @constant {OpCodeType} `OpCodeType('b4')`
   */
  static readonly OP_NOP5: OpCodeType = OpCodeType('b4');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP6
   * @constant {OpCodeType} `OpCodeType('b5')`
   */
  static readonly OP_NOP6: OpCodeType = OpCodeType('b5');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP7
   * @constant {OpCodeType} `OpCodeType('b6')`
   */
  static readonly OP_NOP7: OpCodeType = OpCodeType('b6');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP8
   * @constant {OpCodeType} `OpCodeType('b7')`
   */
  static readonly OP_NOP8: OpCodeType = OpCodeType('b7');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP9
   * @constant {OpCodeType} `OpCodeType('b8')`
   */
  static readonly OP_NOP9: OpCodeType = OpCodeType('b8');
  /**
   * No operation. The word is ignored.
   * @name OP_NOP10
   * @constant {OpCodeType} `OpCodeType('b9')`
   */
  static readonly OP_NOP10: OpCodeType = OpCodeType('b9');

  // The first static const OpCodeType OP_code value after all defined opcodes
  //FIRST_UNDEFINED_OP_VALUE

  // template matching params
  /**
   * Represents a public key hashed with OP_HASH160. The word is used internally for assisting with transaction matching. They are invalid if used in actual scripts.
   * @name OP_PUBKEYHASH
   * @constant {OpCodeType} `OpCodeType('fd')`
   */
  static readonly OP_PUBKEYHASH: OpCodeType = OpCodeType('fd');
  /**
   * Represents a public key compatible with OP_CHECKSIG. The word is used internally for assisting with transaction matching. They are invalid if used in actual scripts.
   * @name OP_PUBKEY
   * @constant {OpCodeType} `OpCodeType('fe')`
   */
  static readonly OP_PUBKEY: OpCodeType = OpCodeType('fe');
  /**
   * Matches any opcode that is not yet assigned. The word is used internally for assisting with transaction matching. They are invalid if used in actual scripts.
   * @name OP_PUBKEY
   * @constant {OpCodeType} `OpCodeType('ff')`
   */
  static readonly OP_INVALIDOPCODE: OpCodeType = OpCodeType('ff');
}
