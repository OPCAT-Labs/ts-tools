export const InjectedParam_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedParam_InputIndexVal = '__scrypt_ts_inputIndexVal';
export const InjectedParam_Prevouts = '__scrypt_ts_prevouts';
export const InjectedParam_Prevout = '__scrypt_ts_prevout';
export const InjectedParam_SpentScriptHashes = '__scrypt_ts_spentScriptHashes';
export const InjectedParam_SpentAmounts = '__scrypt_ts_spentAmounts';
export const InjectedParam_SpentDataHashes = '__scrypt_ts_spentDataHashes';
export const InjectedParam_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedParam_NextStateHashes = '__scrypt_ts_nextStateHashes';
export const InjectedParam_CurState = '__scrypt_ts_curState';
export const InjectedParam_CurTxHashPreimage = '__scrypt_ts_curTxHashPreimage';

export const InjectedProp_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedProp_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedProp_PrevoutsCtx = '__scrypt_ts_prevouts';
export const InjectedProp_Prevout = '__scrypt_ts_prevout';
export const InjectedProp_CurState = '__scrypt_ts_curState';
export const InjectedProp_NextState = '__scrypt_ts_nextState';
export const InjectedProp_SpentScriptHashes = '__scrypt_ts_spentScriptHashes';
export const InjectedProp_SpentAmounts = '__scrypt_ts_spentAmounts';
export const InjectedProp_SpentDataHashes = '__scrypt_ts_spentDataHashes';
export const InjectedProp_CurTxHashPreimage = '__scrypt_ts_curTxHashPreimage';

export const InjectedVar_InputCount = '__scrypt_ts_inputCount';
export const InjectedVar_StateCount = '__scrypt_ts_stateCount';
export const InjectedVar_StateOutputs = '__scrypt_ts_stateOutputs';
export const InjectedVar_StateRoots = '__scrypt_ts_stateRoots';
export const InjectedVar_InputStateHashes = '__scrypt_ts_inputStateHashes';
export const InjectedVar_NextState = '__scrypt_ts_nextState';

// export const BUILD_CHANGE_OUTPUT_FUNCTION = `
// function buildChangeOutput() : bytes {
//   return len(this.${InjectedProp_ChangeInfo}.satoshis) > 0 ? TxUtils.buildOutput(this.${InjectedProp_ChangeInfo}.script, this.${InjectedProp_ChangeInfo}.satoshis) : b'';
// }
// `;

// export const INIT_CHANGE = `this.${InjectedProp_ChangeInfo} = ${InjectedParam_ChangeInfo};`;

export function thisAssignment(intjectedProp: string) {
  return `this.${intjectedProp} = ${intjectedProp};`;
}

export const EMPTY_CONSTRUCTOR = `
constructor(){
}
`;

export const CALL_CHECK_SHPREIMAGE = `require(Tx.checkPreimageSigHashType(ContextUtils.serializeSHPreimage(${InjectedParam_SHPreimage}), SigHash.ALL))`;

export const CALL_BUILD_CHANGE_OUTPUT = {
  accessArgument: `(${InjectedParam_ChangeInfo}.satoshis > 0 ? TxUtils.buildOutput(${InjectedParam_ChangeInfo}.scriptHash, ${InjectedParam_ChangeInfo}.satoshis) : b'')`,
  accessThis: `(this.${InjectedProp_ChangeInfo}.satoshis > 0 ? TxUtils.buildOutput(this.${InjectedProp_ChangeInfo}.scriptHash, this.${InjectedProp_ChangeInfo}.satoshis) : b'')`,
};

export const ACCESS_INPUT_COUNT = {
  accessArgument: InjectedVar_InputCount,
  accessThis: `ContextUtils.checkSpentAmounts(this.${InjectedProp_SpentAmounts}, this.${InjectedProp_SHPreimage}.hashSpentAmounts)`,
}