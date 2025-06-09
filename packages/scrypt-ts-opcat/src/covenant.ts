import { Tap } from '@cmdcode/tapscript'; // Requires node >= 19
import { SmartContract } from './smart-contract/smartContract.js';
import { ByteString, StateHashes } from './smart-contract/types/index.js';
import { TAPROOT_ONLY_SCRIPT_SPENT_KEY } from './smart-contract/consts.js';
import { cloneDeep, p2trLockingScriptToAddr } from './utils/common.js';
import { Script } from './smart-contract/types/script.js';
import { Optional, SupportedNetwork, UTXO, Witness } from './globalTypes.js';
import { verifyWitnessProgram } from './utils/taproot.js';
import { script as bscript } from '@scrypt-inc/bitcoinjs-lib';
import { StructObject } from './smart-contract/types/primitives.js';
import { DEFAULT_NETWORK } from './utils/constants.js';

type AliasedContract<StateT extends StructObject = undefined> = {
  alias?: string;
  contract: SmartContract<StateT>;
};

export type StateProvable = {
  /**
   * The state hashes of all the outputs of the transaction to which the UTXO belongs.
   */
  txoStateHashes: StateHashes;

  /**
   * The preimage of the tx to which the UTXO belongs.
   * Note that the witness data part is not neccessary.
   */
  txHashPreimage: ByteString;
};

export type StateProvableUtxo = UTXO & StateProvable;

export type ExtUtxo = UTXO & Partial<StateProvable>;

export type StatefulCovenantUtxo = StateProvableUtxo;

/**
 * Covenant base class. `Covenant` is a wrapper for `Taproot`. `Covenant` can contain multiple `SmartContract`.
 * Each `SmartContract` is an script path to spend the `Taproot` locking script.
 */
export class Covenant {
  subContracts: Record<string, SmartContract<StructObject | undefined>>;

  readonly tpubkey: string;
  readonly lockingScript: Script;
  readonly address: string;
  readonly accessedInputStateProofs: boolean;
  readonly network: SupportedNetwork;
  utxo?: UTXO;

  constructor(
    subContracts: Array<AliasedContract<StructObject | undefined>>,
    options: {
      network?: SupportedNetwork;
    },
  ) {
    const tapLeafContracts: Record<string, SmartContract<StructObject | undefined>> = {};
    const tapTree = [];
    let accessedInputStateProofs = false;
    for (const { alias, contract } of subContracts) {
      const aliasName = alias || 'default';
      if (tapLeafContracts[aliasName]) {
        throw new Error(`Alias ${aliasName} for contract already exists`);
      }
      tapLeafContracts[aliasName] = contract;
      tapTree.push(contract.tapScript);
      accessedInputStateProofs = accessedInputStateProofs || contract.accessedInputStateProofs;
    }
    const [tpubkey] = Tap.getPubKey(TAPROOT_ONLY_SCRIPT_SPENT_KEY, {
      tree: tapTree,
    });

    for (const cK of subContracts.map((c) => c.alias || 'default')) {
      const taprootContract = tapLeafContracts[cK];
      taprootContract.asTapLeaf(tapTree, tpubkey);
    }
    this.tpubkey = tpubkey;
    this.lockingScript = Script.fromASM(`OP_1 0x${this.tpubkey}`);
    this.subContracts = tapLeafContracts;
    this.network = options.network || DEFAULT_NETWORK;
    this.address = p2trLockingScriptToAddr(this.lockingScript.toHex(), this.network);
    this.accessedInputStateProofs = accessedInputStateProofs;
  }

  static createCovenant<T extends StructObject | undefined>(
    contract: SmartContract<T>,
    options?: {
      network?: SupportedNetwork;
      verify?: boolean;
    },
  ): Covenant {
    return new Covenant([{ contract }], options || {});
  }

  bindToUtxo(utxo: Optional<UTXO, 'script'>): this {
    if (utxo.script && this.lockingScript.toHex() !== utxo.script) {
      throw new Error(
        `Different script, can not bind covenant '${this.constructor.name}' to this UTXO: ${JSON.stringify(utxo)}!`,
      );
    }

    // verify network match
    if (utxo.address && this.address !== utxo.address) {
      throw new Error('The address of the utxo does not match the network of the covenant');
    }

    this.utxo = { ...utxo, script: this.lockingScript.toHex() };
    return this;
  }

  get lockingScriptHex(): ByteString {
    return this.lockingScript.toHex();
  }

  getSubContract(alias: string = 'default'): SmartContract<StructObject | undefined> | undefined {
    return this.subContracts[alias];
  }

  getSubContractCallArg(inputWitness: Witness, method: string, argName: string, alias?: string) {
    const tapLeafContract = this.getSubContract(alias);
    const callArgs = tapLeafContract.witnessToContractCallArgs(inputWitness, method);
    return callArgs.find((arg) => arg.name === argName)?.value;
  }

  verifyWitnessProgram(witness: Witness) {
    const witnessProgram = bscript.createWitnessProgram(this.lockingScript);
    if (witnessProgram) {
      verifyWitnessProgram(witnessProgram.version, witnessProgram.program, witness);
    } else {
      throw new Error('empty witness program');
    }
  }

  get stateHash(): ByteString {
    throw new Error('Non-stateful covenant does not have state hash');
  }
}

/**
 * Stateful covenant base class.
 *
 */
export class StatefulCovenant<StateT extends StructObject> extends Covenant {
  constructor(
    state: StateT,
    subContracts: Array<AliasedContract<StateT>>,
    options: {
      network?: SupportedNetwork;
    },
  ) {
    super(subContracts, options);
    this._state = state;
    subContracts.forEach((c) => {
      const stateType = c.contract.getStateType();
      if (stateType) {
        this.constructor['stateTypeBearer'] = c.contract.constructor;
        c.contract.state = state;
      }
    });
  }

  /**
   * The state of the covenant.
   */
  private _state: StateT;

  utxo?: StatefulCovenantUtxo;

  override bindToUtxo(utxo: Optional<StatefulCovenantUtxo, 'script'>): this {
    return super.bindToUtxo(utxo);
  }

  /**
   * Clone the covenant.
   */
  clone(): StatefulCovenant<StateT> {
    return cloneDeep(this);
  }

  /**
   * Get a new covenant instance with the new state.
   * @param newState the new state
   * @returns the new covenant
   */
  next(newState: StateT): StatefulCovenant<StateT> {
    const next = cloneDeep(this);
    next.state = newState;
    next.utxo = undefined;
    return next;
  }

  get state(): StateT {
    return this._state;
  }

  set state(newState: StateT) {
    this._state = newState;
    // Update the state of all sub-contracts
    Object.keys(this.subContracts).forEach((alias) => {
      const contract = this.subContracts[alias];
      contract.state = newState;
    });
  }

  static stateTypeBearer: typeof SmartContract<StructObject>;

  static override createCovenant<StateT extends StructObject>(
    contract: SmartContract<StateT>,
    options?: {
      network?: SupportedNetwork;
      verify?: boolean;
    },
  ): StatefulCovenant<StateT> {
    const CovenantClass = class extends StatefulCovenant<StateT> {
      constructor(state: StateT) {
        super(
          state,
          [
            {
              contract,
            },
          ],
          options || {},
        );
      }
    };

    return new CovenantClass(contract.state);
  }

  override get stateHash(): ByteString {
    if (this.constructor['stateTypeBearer'] === undefined) {
      throw new Error('State type bearer is not defined');
    }
    return (this.constructor as typeof StatefulCovenant).stateTypeBearer.stateHash(this._state);
  }
}
