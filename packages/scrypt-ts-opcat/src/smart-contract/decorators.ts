import 'reflect-metadata';
import { SigHashType } from './types/primitives.js';
import type { SmartContract } from './smartContract.js';

/**
 * Helper type to get only string literal keys from a type,
 * excluding index signature keys (string | number).
 */
type StringLiteralKeys<T> = keyof T extends infer K
  ? K extends string
    ? string extends K
      ? never  // Exclude index signature (string extends K means K is 'string')
      : K
    : never
  : never;

/**
 * Extracts public method names from a contract instance type,
 * excluding methods inherited from SmartContract base class.
 *
 * This type uses StringLiteralKeys to filter out index signature keys,
 * solving the StructObject pollution issue.
 *
 * @example
 * ```typescript
 * // For a Genesis contract with checkDeploy method:
 * type Methods = PublicMethodsOf<Genesis>; // 'checkDeploy'
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PublicMethodsOf<T> = {
  [K in StringLiteralKeys<T>]: T[K] extends (...args: any[]) => any
    ? K extends keyof SmartContract
      ? never
      : K
    : never;
}[StringLiteralKeys<T>];

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
 * When `autoCheckInputState` is set to true, the system will automatically check the StateHash of all inputs
 * in the current transaction by default.  Otherwise, you can use `this.checkInputStateHash(inputIndex: Int32, stateHash: ByteString)`
 * to manually specify which input's StateHash to verify.
 * @category decorator
 * @onchain
 */
export interface MethodDecoratorOptions {
  autoCheckInputState: boolean;
}

/**
 * Indicates whether the method is a contract method, and ordinary methods do not affect the execution of the contract.
 * @category decorator
 * @onchain
 */
export function method(options: MethodDecoratorOptions = { autoCheckInputState: true }) {
  const sigHashType: SigHashType = SigHashType.ALL;
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
          if (this.isSmartContractLib && this.isSmartContractLib()) {
            return originalMethod.apply(this, args);
          }

          // instance method on subclasses of `SmartContract`
          //const isSmartContractMethod = this instanceof SmartContract;

          // if public @method of smart contract is called
          if (this.isSmartContract && this.isSmartContract()) {
            if (this.isPubFunction(methodName)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const self = this as any;
              const curPsbt = self.spentPsbt;

              self.setSighashType(sigHashType);
              self.extendMethodArgs(methodName, args, options.autoCheckInputState);

              if (curPsbt !== undefined && !curPsbt.isFinalizing) {
                // the psbt is not finalizing, so just extend the arguments, but not run the method
                return;
              }
            }

            return originalMethod.apply(this, args);
          }

          throw new Error(
            `@method decorator used on \`${this.name || this.constructor.name
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

/**
 * @ignore
 */
export const TagsMetaKey = 'scrypt:tags';

/**
 * tags decorator, used to set the tags of the contract, decorating the SmartContract class
 * @param vals the tags to set
 * 
 */
export function tags(vals: string[]) {
  return function (target: any) {
    // the tags can be retrive in the SmartContract class, and the tags are set in the constructor of the SmartContract class
    // so we need to set the tags in the constructor of the SmartContract class
    const constructor = target.constructor;
    if (!constructor) {
      throw new Error('None constructor! Please use the @tags decorator on the SmartContract class');
    }
    const uniqueTags = vals.filter((tag, index, arr) => arr.indexOf(tag) == index);
    const hasDuplicateTags = uniqueTags.length !== vals.length;
    if (hasDuplicateTags) {
      throw new Error(`tags(${JSON.stringify(vals)}) has duplicate tags`)
    }
    Object.defineProperty(target, 'tags', {
      value: vals,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    return target;
  }
}

/**
 * Metadata key for storing unlock method mappings.
 * Maps lock method names to their corresponding unlock method names.
 * @ignore
 */
export const UnlocksMetaKey = 'scrypt:unlocks';

/**
 * Type for SmartContract constructor (class type).
 * Used to constrain the first parameter of @unlock decorator.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SmartContractConstructor = abstract new (...args: any[]) => SmartContract;

/**
 * Marks a static method as the unlock method for a corresponding public lock method.
 *
 * This decorator creates a pairing between a lock method (decorated with @method())
 * and its unlock method. When addContractInput is called with a method name,
 * the system can automatically find and invoke the paired unlock method.
 *
 * @param contractClass - The contract class (used for TypeScript type inference)
 * @param lockMethodName - The name of the public lock method this unlock method pairs with (with autocompletion!)
 * @returns A method decorator
 *
 * @example
 * ```typescript
 * @tags(['GENESIS'])
 * export class Genesis extends SmartContract {
 *   @method()
 *   public checkDeploy(outputs: FixedArray<TxOut, 6>) {
 *     // lock method logic
 *   }
 *
 *   @unlock(Genesis, 'checkDeploy')  // 'checkDeploy' has autocompletion!
 *   static unlockCheckDeploy(ctx: UnlockContext<Genesis>): void {
 *     const { contract, psbt } = ctx;
 *     const outputs = buildOutputsFromPsbt(psbt);
 *     contract.checkDeploy(outputs);
 *   }
 * }
 * ```
 *
 * @category decorator
 */
export function unlock<T extends SmartContractConstructor>(
  _contractClass: T,
  lockMethodName: PublicMethodsOf<InstanceType<T>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, methodName: string, descriptor: PropertyDescriptor) {
    if (!descriptor) {
      throw new Error('None method descriptor!');
    }

    // Get or create the unlocks map on the class (not instance)
    const unlocks: Map<string, string> =
      Reflect.getOwnMetadata(UnlocksMetaKey, target) || new Map();

    // Map lock method name -> unlock method name
    unlocks.set(lockMethodName as string, methodName);
    Reflect.defineMetadata(UnlocksMetaKey, unlocks, target);

    return descriptor;
  };
}