import 'reflect-metadata';
import { SmartContract } from './smartContract.js';
import { SmartContractLib } from './smartContractLib.js';
import { SigHashType } from './types/primitives.js';

/**
 * @ignore
 */
export const MethodsMetaKey = 'scrypt:methods';

/**
 * @ignore
 */
export interface MethodsMetaValue {
  argLength: number;
  sigHashType: SigHashType;
}

/**
 * When `autoCheckInputStateHash` is set to true, the system will automatically check the StateHash of all inputs
 * in the current transaction by default.  Otherwise, you can use `this.checkInputStateHash(inputIndex: Int32, stateHash: ByteString)`
 * to manually specify which input's StateHash to verify.
 * @category decorator
 * @onchain
 */
export interface MethodDecoratorOptions {
  autoCheckInputStateHash: boolean;
}

/**
 * Indicates whether the method is a contract method, and ordinary methods do not affect the execution of the contract.
 * @category decorator
 * @onchain
 */
export function method(options: MethodDecoratorOptions = { autoCheckInputStateHash: true }) {
  const sigHashType: SigHashType = SigHashType.DEFAULT;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, methodName: string, descriptor: PropertyDescriptor) {
    if (!descriptor) {
      throw new Error('None method descriptor!');
    }
    const originalMethod = descriptor.value;

    const methods: Map<string, MethodsMetaValue> =
      Reflect.getOwnMetadata(MethodsMetaKey, target) || new Map();
    methods.set(methodName, { argLength: originalMethod.length, sigHashType });
    Reflect.defineMetadata(MethodsMetaKey, methods, target);

    const newDescriptor: PropertyDescriptor = {
      configurable: true,
      enumerable: false,
      get() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wrappedMethod = (...args: any[]) => {
          // static method on subclasses of `SmartContract`
          const isStatic = typeof target === 'function';
          if (isStatic) {
            return originalMethod.apply(this, args);
          }

          // instance method on subclasses of `SmartContractLib`
          const isSmartContractLib = this instanceof SmartContractLib;

          if (isSmartContractLib) {
            return originalMethod.apply(this, args);
          }

          // instance method on subclasses of `SmartContract`
          const isSmartContractMethod = this instanceof SmartContract;

          // if public @method of smart contract is called
          if (isSmartContractMethod) {
            if (this.isPubFunction(methodName)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const self = this as SmartContract<any>;
              const curPsbt = self.spentPsbt;

              self.setSighashType(sigHashType);
              self.clearStateVars();
              self.extendMethodArgs(methodName, args, options.autoCheckInputStateHash);

              if (curPsbt !== undefined && !curPsbt.isFinalizing) {
                // the psbt is not finalizing, so just extend the arguments, but not run the method
                return;
              }
            }

            return originalMethod.apply(this, args);
          }

          throw new Error(
            `@method decorator used on \`${
              this.name || this.constructor.name
            }#${methodName}\`, it should only be used in subclasses of \`SmartContract\` or \`SmartContractLib\``,
          );
        };

        return wrappedMethod;
      },
    };
    return newDescriptor;
  };
}

/**
 * @ignore
 */
export const PropsMetaKey = 'scrypt:props';

/**
 * Indicates whether the property is an property of a contract, and ordinary class properties cannot be accessed in contract methods
 * @category decorator
 * @onchain
 */
export function prop() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyName: string) {
    const props = (Reflect.getMetadata(PropsMetaKey, target) || []).concat(propertyName);
    Reflect.defineMetadata(PropsMetaKey, props, target);
  };
}
