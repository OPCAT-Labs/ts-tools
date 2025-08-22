export = Stack;
/**
 * Represents a stack structure with optional variable stack support.
 * @constructor
 * @param {Array.<string>} rawstack - The initial stack array
 * @param {Array.<string>} [varStack] - Optional variable stack array
 */
declare function Stack(rawstack: Array<string>, varStack?: Array<string>): void;
declare class Stack {
    /**
     * Represents a stack structure with optional variable stack support.
     * @constructor
     * @param {Array.<string>} rawstack - The initial stack array
     * @param {Array.<string>} [varStack] - Optional variable stack array
     */
    constructor(rawstack: Array<string>, varStack?: Array<string>);
    stack: string[];
    varStack: string[];
    pushVar(varName: any): void;
    popVar(): void;
    push(n: any, varName: any): void;
    pop(): string;
    updateTopVars(vars: any): void;
    stacktop(i: any): string;
    vartop(i: any): string;
    slice(start: any, end: any): string[];
    splice(start: any, deleteCount: any, ...items: any[]): string[];
    write(i: any, value: any): void;
    copy(): Stack;
    printVarStack(): void;
    checkConsistency(): void;
    checkConsistencyWithVars(varStack: any): void;
    get length(): number;
    get rawstack(): string[];
}
