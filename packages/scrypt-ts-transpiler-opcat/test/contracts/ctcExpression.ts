import { method, SmartContract, assert } from '@opcat-labs/scrypt-ts-opcat';

const One = 1n;
const AnotherOne = One;
const Two = One + AnotherOne;
const Three = 1n + Two;
const Four = 1n + 3n;
const Seven = (Three - 1n) * (Four - 1n) + Two - AnotherOne;

const NegativeOne = -1n;
const AnotherNegativeOne = -One;
const NegativeThree = Four - Seven;
const NegativeFive = -6n + One;
const NegativeSix = -2n - 4n;
const NegativeNine =
  -15n + -AnotherNegativeOne - -Two * (-Three * (NegativeSix - NegativeFive) + 1n) + NegativeThree;

const Six = 6;
const Eight = +8;
const AnotherEight = Eight;
const Fourteen = Six + Eight;
const Eleven = 3 + Eight;
const Ten = -2 + +12;
const Nine = -2 - -11;
const Zero = -15 + -(Eleven - Fourteen) * +2 + Ten - -AnotherEight + -Nine;

export class CtcExpression extends SmartContract {
  static readonly One = 1n;
  static readonly AnotherOne = One;
  static readonly Two = One + AnotherOne;
  static readonly Three = 1n + Two;
  static readonly Four = 1n + 3n;
  static readonly Seven = (Three - 1n) * (Four - 1n) + Two - AnotherOne;

  static readonly NegativeOne = -1n;
  static readonly AnotherNegativeOne = -One;
  static readonly NegativeThree = Four - Seven;
  static readonly NegativeFive = -6n + One;
  static readonly NegativeSix = -2n - 4n;
  static readonly NegativeNine =
    -15n +
    -AnotherNegativeOne -
    -Two * (-Three * (NegativeSix - NegativeFive) + 1n) +
    NegativeThree;

  static readonly Six = 6;
  static readonly Eight = +8;
  static readonly AnotherEight = Eight;
  static readonly Fourteen = Six + Eight;
  static readonly Eleven = 3 + Eight;
  static readonly Ten = -2 + +12;
  static readonly Nine = -2 - -11;
  static readonly Zero = -15 + -(Eleven - Fourteen) * +2 + Ten - -AnotherEight + -Nine;

  @method()
  public unlock() {
    assert(One == 1n);
    assert(AnotherOne == 1n);
    assert(Two == 2n);
    assert(Three == 3n);
    assert(Four == 4n);
    assert(Seven == 7n);

    assert(NegativeOne == -1n);
    assert(AnotherNegativeOne == -1n);
    assert(NegativeThree == -3n);
    assert(NegativeFive == -5n);
    assert(NegativeSix == -6n);
    assert(NegativeNine == -9n);

    assert(Six == 6);
    assert(Eight == 8);
    assert(AnotherEight == 8);
    assert(Fourteen == 14);
    assert(Eleven == 11);
    assert(Ten == 10);
    assert(Nine == 9);
    assert(Zero == 0);

    assert(CtcExpression.One == 1n);
    assert(CtcExpression.AnotherOne == 1n);
    assert(CtcExpression.Two == 2n);
    assert(CtcExpression.Three == 3n);
    assert(CtcExpression.Four == 4n);
    assert(CtcExpression.Seven == 7n);

    assert(CtcExpression.NegativeOne == -1n);
    assert(CtcExpression.AnotherNegativeOne == -1n);
    assert(CtcExpression.NegativeThree == -3n);
    assert(CtcExpression.NegativeFive == -5n);
    assert(CtcExpression.NegativeSix == -6n);
    assert(CtcExpression.NegativeNine == -9n);

    assert(CtcExpression.Six == 6);
    assert(CtcExpression.Eight == 8);
    assert(CtcExpression.AnotherEight == 8);
    assert(CtcExpression.Fourteen == 14);
    assert(CtcExpression.Eleven == 11);
    assert(CtcExpression.Ten == 10);
    assert(CtcExpression.Nine == 9);
    assert(CtcExpression.Zero == 0);

    for (let i = 0; i < AnotherOne; i++) {
      assert(true);
    }
    for (let i = 0; i < -CtcExpression.Nine + Ten; i++) {
      assert(true);
    }
    for (let i = 0; i < Ten - CtcExpression.Nine; i++) {
      assert(true);
    }
    for (let i = 0; i < Zero + 1; i++) {
      assert(true);
    }
  }
}
