import assert from "assert";
import { method } from "../decorators";
import { SmartContractLib } from "../smartContractLib";
import { __ScryptInternalHashedMap__ } from "../types/structs";



/**
 * add dummy method to make some structs not be removed by the transpiler
 */
export class DummyLib extends SmartContractLib {

  // defined a method to avoid `__ScryptInternalHashedMap__` in structs.ts being removed by the transpiler
  @method()
  static dummyMethod1(arg: __ScryptInternalHashedMap__): boolean {
    return true;
  }
}