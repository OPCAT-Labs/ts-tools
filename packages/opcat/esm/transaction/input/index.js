
import Input from './input.js';
import PublicKey from './publickey.js';
import PublicKeyHash from './publickeyhash.js';
import MultiSig from './multisig.js';

Input.PublicKey = PublicKey;
Input.PublicKeyHash = PublicKeyHash;
Input.MultiSig = MultiSig;

export default Input;
export {};
export { PublicKey, PublicKeyHash, MultiSig };