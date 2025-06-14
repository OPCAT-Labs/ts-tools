import { SmartContract, StructObject, assert, method } from '@scrypt-inc/scrypt-ts-btc';

export interface ScryptParserCase1T extends StructObject {
  b: boolean;
}

export class ScryptParserCase1 extends SmartContract {
  /// Relink's scryptParser should handle the function arguments successfully
  @method()
  public unlock(
    lpToMint: ScryptParserCase1T,
    lpSupply: ScryptParserCase1T,
    xIn: ScryptParserCase1T,
    yIn: ScryptParserCase1T,
    x: ScryptParserCase1T,
    y: ScryptParserCase1T,
  ) {
    assert(lpToMint.b && lpSupply.b && xIn.b && yIn.b && x.b && y.b);
  }
}
