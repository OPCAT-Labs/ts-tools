export = JSUtil;
/**
 * Utility functions for JavaScript operations.
 * @constructor
 */
declare function JSUtil(): void;
declare class JSUtil {
}
declare namespace JSUtil {
    /**
     * Determines whether a string contains only hexadecimal values
     *
     * @name JSUtil.isHexa
     * @param {string} value
     * @return {boolean} true if the string is the hexa representation of a number
     */
    function isHexa(value: string): boolean;
    /**
     * Determines whether a string contains only hexadecimal values
     *
     * @name JSUtil.isHexaString
     * @param {string} value
     * @return {boolean} true if the string is the hexa representation of a number
     */
    function isHexaString(value: string): boolean;
    /**
     * Checks that a value is a natural number, a positive integer or zero.
     *
     * @param {*} value - The value to be tested for naturality
     * @return {Boolean} - true if value is natural
     */
    function isNaturalNumber(value: any): boolean;
    /**
    * Transform a 4-byte integer (unsigned value) into a Buffer of length 4 (Big Endian Byte Order)
    *
    * @param {number} integer
    * @return {Buffer}
    */
    function integerAsBuffer(integer: number): Buffer;
    /**
     * Test if an argument is a valid JSON object. If it is, returns a truthy
     * value (the json object decoded), so no double JSON.parse call is necessary
     *
     * @param {string} arg
     * @return {boolean} false if the argument is not a JSON string.
     */
    function isValidJSON(arg: string): boolean;
    /**
       * Define immutable properties on a target object
       *
       * @param {Object} target - An object to be extended
       * @param {Object} values - An object of properties
       * @return {Object} The target object
       */
    function defineImmutable(target: any, values: any): any;
}
