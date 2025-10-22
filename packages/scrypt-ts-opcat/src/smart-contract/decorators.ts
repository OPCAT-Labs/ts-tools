import 'reflect-metadata';
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
    Object.defineProperty(target, 'tags', {
      value: vals.filter((tag, index, arr) => arr.indexOf(tag) == index),
      writable: false,
      enumerable: false,
      configurable: false,
    });
    return target;
  }
}