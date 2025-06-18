import { SmartContract, assert, method } from '@opcat-labs/scrypt-ts-opcat';

// https://en.wikipedia.org/wiki/Names_of_large_numbers
const Thousand = 1000n;
const Million = Thousand * Thousand;
const Billion = Million * Thousand;
const Trillion = Billion * Thousand;
const Quadrillion = Trillion * Thousand;
const Quintillion = Quadrillion * Thousand;
const Sextillion = Quintillion * Thousand;
const Septillion = Sextillion * -(-Thousand);
const Octillion = Septillion * Thousand;

export class CtcBigNumber extends SmartContract {
  @method()
  public unlock() {
    assert(Octillion == 1000000000000000000000000000n);
  }
}
