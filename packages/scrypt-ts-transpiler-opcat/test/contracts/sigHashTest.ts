import { assert, BacktraceInfo, ByteString, Int32, method, PubKey, Sig, SmartContract } from "@opcat-labs/scrypt-ts-opcat";

// Local SigHashType object for decorator parameters
// This is needed because const enum is not available at runtime in tsx
const SigHashType = {
  ALL: 0x01,
  NONE: 0x02,
  SINGLE: 0x03,
  ANYONECANPAY_ALL: 0x81,
  ANYONECANPAY_NONE: 0x82,
  ANYONECANPAY_SINGLE: 0x83,
} as const;

export type S = {
    a: bigint
}

/**
 * Comprehensive test contract for sighash type API restrictions.
 * This contract only includes VALID combinations that should transpile successfully.
 *
 * Invalid combinations are tested in separate files under contracts/invalid/:
 * - sighashAnyonecanpayHashPrevouts.ts: ANYONECANPAY + hashPrevouts
 * - sighashAnyonecanpayInputIndex.ts: ANYONECANPAY + inputIndex
 * - sighashAnyonecanpayInputCount.ts: ANYONECANPAY + inputCount
 * - sighashNoneHashOutputs.ts: NONE + hashOutputs
 * - sighashAnyonecanpayNoneHashOutputs.ts: ANYONECANPAY_NONE + hashOutputs
 * - sigHashChange.ts: ANYONECANPAY_SINGLE + buildChangeOutput
 */
export class SigHashTest extends SmartContract<S> {

    // ══════════════════════════════════════════════════════════════════════════
    // buildChangeOutput - only valid with ALL and ANYONECANPAY_ALL
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_buildChangeOutput_ALL() {
        const outputs = this.buildChangeOutput();
        assert(this.checkOutputs(outputs));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_buildChangeOutput_ANYONECANPAY_ALL() {
        const outputs = this.buildChangeOutput();
        assert(this.checkOutputs(outputs));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // checkSig - valid with all sighash types
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_checkSig_ALL(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    @method({sigHashType: SigHashType.NONE})
    public test_checkSig_NONE(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_checkSig_SINGLE(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_checkSig_ANYONECANPAY_ALL(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_checkSig_ANYONECANPAY_NONE(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_checkSig_ANYONECANPAY_SINGLE(sig: Sig, pubKey: PubKey) {
        assert(this.checkSig(sig, pubKey));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // checkSigWithFlag - valid with all sighash types
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_checkSigWithFlag_ALL(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    @method({sigHashType: SigHashType.NONE})
    public test_checkSigWithFlag_NONE(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_checkSigWithFlag_SINGLE(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_checkSigWithFlag_ANYONECANPAY_ALL(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_checkSigWithFlag_ANYONECANPAY_NONE(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_checkSigWithFlag_ANYONECANPAY_SINGLE(sig: Sig, pubKey: PubKey, sigHashFlag: bigint) {
        assert(this.checkSigWithFlag(sig, pubKey, sigHashFlag));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // timeLock - valid with all sighash types (uses nSequence from current input)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_timeLock_ALL(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    @method({sigHashType: SigHashType.NONE})
    public test_timeLock_NONE(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_timeLock_SINGLE(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_timeLock_ANYONECANPAY_ALL(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_timeLock_ANYONECANPAY_NONE(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_timeLock_ANYONECANPAY_SINGLE(nLockTime: Int32) {
        assert(this.timeLock(nLockTime));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // checkOutputs - valid with ALL, SINGLE, ANYONECANPAY_ALL, ANYONECANPAY_SINGLE
    // NOT valid with NONE and ANYONECANPAY_NONE (hashOutputs is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_checkOutputs_ALL(outputs: ByteString) {
        assert(this.checkOutputs(outputs));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_checkOutputs_SINGLE(outputs: ByteString) {
        assert(this.checkOutputs(outputs));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_checkOutputs_ANYONECANPAY_ALL(outputs: ByteString) {
        assert(this.checkOutputs(outputs));
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_checkOutputs_ANYONECANPAY_SINGLE(outputs: ByteString) {
        assert(this.checkOutputs(outputs));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // checkInputState - NOT valid with ANYONECANPAY (needs spentDataHashes)
    // Note: checkInputState must be used as a standalone statement, not inside assert()
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_checkInputState_ALL(idx: bigint, serializedState: ByteString) {
        this.checkInputState(idx, serializedState);
        assert(true);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_checkInputState_NONE(idx: bigint, serializedState: ByteString) {
        this.checkInputState(idx, serializedState);
        assert(true);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_checkInputState_SINGLE(idx: bigint, serializedState: ByteString) {
        this.checkInputState(idx, serializedState);
        assert(true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // backtraceToOutpoint - NOT valid with ANYONECANPAY (needs prevouts)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_backtraceToOutpoint_ALL(backtraceInfo: BacktraceInfo, genesisOutpoint: ByteString) {
        assert(this.backtraceToOutpoint(backtraceInfo, genesisOutpoint));
    }

    @method({sigHashType: SigHashType.NONE})
    public test_backtraceToOutpoint_NONE(backtraceInfo: BacktraceInfo, genesisOutpoint: ByteString) {
        assert(this.backtraceToOutpoint(backtraceInfo, genesisOutpoint));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_backtraceToOutpoint_SINGLE(backtraceInfo: BacktraceInfo, genesisOutpoint: ByteString) {
        assert(this.backtraceToOutpoint(backtraceInfo, genesisOutpoint));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // backtraceToScript - NOT valid with ANYONECANPAY (needs prevouts)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_backtraceToScript_ALL(backtraceInfo: BacktraceInfo, genesisScript: ByteString) {
        assert(this.backtraceToScript(backtraceInfo, genesisScript));
    }

    @method({sigHashType: SigHashType.NONE})
    public test_backtraceToScript_NONE(backtraceInfo: BacktraceInfo, genesisScript: ByteString) {
        assert(this.backtraceToScript(backtraceInfo, genesisScript));
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_backtraceToScript_SINGLE(backtraceInfo: BacktraceInfo, genesisScript: ByteString) {
        assert(this.backtraceToScript(backtraceInfo, genesisScript));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.nVersion - valid with all sighash types
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_nVersion_ALL() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_nVersion_NONE() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_nVersion_SINGLE() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_nVersion_ANYONECANPAY_ALL() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_nVersion_ANYONECANPAY_NONE() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_nVersion_ANYONECANPAY_SINGLE() {
        const v = this.ctx.nVersion;
        assert(v === v);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashPrevouts - NOT valid with ANYONECANPAY (hash field is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashPrevouts_ALL() {
        const h = this.ctx.hashPrevouts;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_hashPrevouts_NONE() {
        const h = this.ctx.hashPrevouts;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashPrevouts_SINGLE() {
        const h = this.ctx.hashPrevouts;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.inputIndex - NOT valid with ANYONECANPAY (cannot be computed from empty hashes)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_inputIndex_ALL() {
        const idx = this.ctx.inputIndex;
        assert(idx === idx);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_inputIndex_NONE() {
        const idx = this.ctx.inputIndex;
        assert(idx === idx);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_inputIndex_SINGLE() {
        const idx = this.ctx.inputIndex;
        assert(idx === idx);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.outpoint - valid with all sighash types (direct field from preimage)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_outpoint_ALL() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_outpoint_NONE() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_outpoint_SINGLE() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_outpoint_ANYONECANPAY_ALL() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_outpoint_ANYONECANPAY_NONE() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_outpoint_ANYONECANPAY_SINGLE() {
        const o = this.ctx.outpoint;
        assert(o === o);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.spentScriptHash - valid with all sighash types (direct field from preimage)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_spentScriptHash_ALL() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_spentScriptHash_NONE() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_spentScriptHash_SINGLE() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_spentScriptHash_ANYONECANPAY_ALL() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_spentScriptHash_ANYONECANPAY_NONE() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_spentScriptHash_ANYONECANPAY_SINGLE() {
        const h = this.ctx.spentScriptHash;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.spentDataHash - valid with all sighash types (direct field from preimage)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_spentDataHash_ALL() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_spentDataHash_NONE() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_spentDataHash_SINGLE() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_spentDataHash_ANYONECANPAY_ALL() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_spentDataHash_ANYONECANPAY_NONE() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_spentDataHash_ANYONECANPAY_SINGLE() {
        const h = this.ctx.spentDataHash;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.value - valid with all sighash types (direct field from preimage)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_value_ALL() {
        const v = this.ctx.value;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_value_NONE() {
        const v = this.ctx.value;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_value_SINGLE() {
        const v = this.ctx.value;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_value_ANYONECANPAY_ALL() {
        const v = this.ctx.value;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_value_ANYONECANPAY_NONE() {
        const v = this.ctx.value;
        assert(v === v);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_value_ANYONECANPAY_SINGLE() {
        const v = this.ctx.value;
        assert(v === v);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.nSequence - valid with all sighash types (current input's sequence)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_nSequence_ALL() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_nSequence_NONE() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_nSequence_SINGLE() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_nSequence_ANYONECANPAY_ALL() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_nSequence_ANYONECANPAY_NONE() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_nSequence_ANYONECANPAY_SINGLE() {
        const seq = this.ctx.nSequence;
        assert(seq === seq);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashSpentAmounts - NOT valid with ANYONECANPAY (hash field is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashSpentAmounts_ALL() {
        const h = this.ctx.hashSpentAmounts;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_hashSpentAmounts_NONE() {
        const h = this.ctx.hashSpentAmounts;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashSpentAmounts_SINGLE() {
        const h = this.ctx.hashSpentAmounts;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashSpentScriptHashes - NOT valid with ANYONECANPAY (hash field is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashSpentScriptHashes_ALL() {
        const h = this.ctx.hashSpentScriptHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_hashSpentScriptHashes_NONE() {
        const h = this.ctx.hashSpentScriptHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashSpentScriptHashes_SINGLE() {
        const h = this.ctx.hashSpentScriptHashes;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashSpentDataHashes - NOT valid with ANYONECANPAY (hash field is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashSpentDataHashes_ALL() {
        const h = this.ctx.hashSpentDataHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_hashSpentDataHashes_NONE() {
        const h = this.ctx.hashSpentDataHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashSpentDataHashes_SINGLE() {
        const h = this.ctx.hashSpentDataHashes;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashSequences - NOT valid with ANYONECANPAY (hash field is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashSequences_ALL() {
        const h = this.ctx.hashSequences;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_hashSequences_NONE() {
        const h = this.ctx.hashSequences;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashSequences_SINGLE() {
        const h = this.ctx.hashSequences;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.hashOutputs - NOT valid with NONE and ANYONECANPAY_NONE (hash is empty)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_hashOutputs_ALL() {
        const h = this.ctx.hashOutputs;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_hashOutputs_SINGLE() {
        const h = this.ctx.hashOutputs;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_hashOutputs_ANYONECANPAY_ALL() {
        const h = this.ctx.hashOutputs;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_hashOutputs_ANYONECANPAY_SINGLE() {
        const h = this.ctx.hashOutputs;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.nLockTime - valid with all sighash types
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_nLockTime_ALL() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_nLockTime_NONE() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_nLockTime_SINGLE() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_nLockTime_ANYONECANPAY_ALL() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_nLockTime_ANYONECANPAY_NONE() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_nLockTime_ANYONECANPAY_SINGLE() {
        const lt = this.ctx.nLockTime;
        assert(lt === lt);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.sigHashType - valid with all sighash types
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_sigHashType_ALL() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_sigHashType_NONE() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_sigHashType_SINGLE() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_sigHashType_ANYONECANPAY_ALL() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_sigHashType_ANYONECANPAY_NONE() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_sigHashType_ANYONECANPAY_SINGLE() {
        const t = this.ctx.sigHashType;
        assert(t === t);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.inputCount - NOT valid with ANYONECANPAY (needs spentAmounts to compute)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_inputCount_ALL() {
        const c = this.ctx.inputCount;
        assert(c === c);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_inputCount_NONE() {
        const c = this.ctx.inputCount;
        assert(c === c);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_inputCount_SINGLE() {
        const c = this.ctx.inputCount;
        assert(c === c);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.prevout - valid with all sighash types (derived from outpoint)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_prevout_ALL() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_prevout_NONE() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_prevout_SINGLE() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_ctx_prevout_ANYONECANPAY_ALL() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_ctx_prevout_ANYONECANPAY_NONE() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_ctx_prevout_ANYONECANPAY_SINGLE() {
        const p = this.ctx.prevout;
        assert(p.txHash === p.txHash);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.prevouts - NOT valid with ANYONECANPAY (needs hashPrevouts)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_prevouts_ALL() {
        const p = this.ctx.prevouts;
        assert(p === p);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_prevouts_NONE() {
        const p = this.ctx.prevouts;
        assert(p === p);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_prevouts_SINGLE() {
        const p = this.ctx.prevouts;
        assert(p === p);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.spentScriptHashes - NOT valid with ANYONECANPAY (needs hashSpentScriptHashes)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_spentScriptHashes_ALL() {
        const h = this.ctx.spentScriptHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_spentScriptHashes_NONE() {
        const h = this.ctx.spentScriptHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_spentScriptHashes_SINGLE() {
        const h = this.ctx.spentScriptHashes;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.spentAmounts - NOT valid with ANYONECANPAY (needs hashSpentAmounts)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_spentAmounts_ALL() {
        const a = this.ctx.spentAmounts;
        assert(a === a);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_spentAmounts_NONE() {
        const a = this.ctx.spentAmounts;
        assert(a === a);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_spentAmounts_SINGLE() {
        const a = this.ctx.spentAmounts;
        assert(a === a);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ctx.spentDataHashes - NOT valid with ANYONECANPAY (needs hashSpentDataHashes)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_ctx_spentDataHashes_ALL() {
        const h = this.ctx.spentDataHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_ctx_spentDataHashes_NONE() {
        const h = this.ctx.spentDataHashes;
        assert(h === h);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_ctx_spentDataHashes_SINGLE() {
        const h = this.ctx.spentDataHashes;
        assert(h === h);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // changeInfo.satoshis - valid with all sighash types (part of changeInfo)
    // ══════════════════════════════════════════════════════════════════════════

    @method({sigHashType: SigHashType.ALL})
    public test_changeInfo_satoshis_ALL() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }

    @method({sigHashType: SigHashType.NONE})
    public test_changeInfo_satoshis_NONE() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }

    @method({sigHashType: SigHashType.SINGLE})
    public test_changeInfo_satoshis_SINGLE() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_ALL})
    public test_changeInfo_satoshis_ANYONECANPAY_ALL() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_NONE})
    public test_changeInfo_satoshis_ANYONECANPAY_NONE() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }

    @method({sigHashType: SigHashType.ANYONECANPAY_SINGLE})
    public test_changeInfo_satoshis_ANYONECANPAY_SINGLE() {
        const s = this.changeInfo.satoshis;
        assert(s === s);
    }
}
