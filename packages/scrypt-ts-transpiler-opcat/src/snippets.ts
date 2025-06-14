export const InjectedParam_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedParam_InputIndexVal = '__scrypt_ts_inputIndexVal';
export const InjectedParam_Prevouts = '__scrypt_ts_prevouts';
export const InjectedParam_Prevout = '__scrypt_ts_prevout';
export const InjectedParam_SpentScripts = '__scrypt_ts_spentScripts';
export const InjectedParam_SpentAmounts = '__scrypt_ts_spentAmounts';
export const InjectedParam_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedParam_NextStateHashes = '__scrypt_ts_nextStateHashes';
export const InjectedParam_CurState = '__scrypt_ts_curState';
export const InjectedParam_InputStateProof = '__scrypt_ts_inputStateProof';
export const InjectedParam_InputStateProofs = '__scrypt_ts_inputStateProofs';

export const InjectedProp_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedProp_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedProp_PrevoutsCtx = '__scrypt_ts_prevouts';
export const InjectedProp_CurState = '__scrypt_ts_curState';
export const InjectedProp_NextState = '__scrypt_ts_nextState';
export const InjectedProp_SpentScripts = '__scrypt_ts_spentScripts';
export const InjectedProp_SpentAmounts = '__scrypt_ts_spentAmounts';

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

export const CALL_CHECK_SHPREIMAGE = `require(checkSig(ContextUtils.checkSHPreimage(${InjectedParam_SHPreimage}), ContextUtils.Gx))`;

export const CALL_CHECK_INPUT_INDEX = `require(TxUtils.indexValueToBytes(${InjectedParam_InputIndexVal}) == ${InjectedParam_SHPreimage}.inputIndex)`;

export const CALL_BUILD_STATE_OUTPUTS = {
  accessArgument: `StateUtils.buildStateHashRootOutput(${InjectedParam_NextStateHashes}, ${InjectedVar_StateRoots}, ${InjectedVar_StateCount}) + ${InjectedVar_StateOutputs}`,
  accessThis: `StateUtils.buildStateHashRootOutput(this.${InjectedParam_NextStateHashes}, this.${InjectedVar_StateRoots}, this.${InjectedVar_StateCount}) + this.${InjectedVar_StateOutputs}`,
};

export const DECLARE_STATE_VARS = {
  declareLocal: [
    `int ${InjectedVar_StateCount} = 0;`,
    `bytes ${InjectedVar_StateOutputs} = b'';`,
    `bytes ${InjectedVar_StateRoots} = b'';`,
  ].join('\n'),
  assignThis: [
    `this.${InjectedVar_StateCount} = 0;`,
    `this.${InjectedVar_StateOutputs} = b'';`,
    `this.${InjectedVar_StateRoots} = b'';`,
  ].join('\n'),
};

export const CALL_BUILD_CHANGE_OUTPUT = {
  accessArgument: `(len(${InjectedParam_ChangeInfo}.script) > 0 ? TxUtils.buildOutput(${InjectedParam_ChangeInfo}.script, ${InjectedParam_ChangeInfo}.satoshis) : b'')`,
  accessThis: `(len(this.${InjectedProp_ChangeInfo}.script) > 0 ? TxUtils.buildOutput(this.${InjectedProp_ChangeInfo}.script, this.${InjectedProp_ChangeInfo}.satoshis) : b'')`,
};

export const INPUT_STATE_PROOF_EXPR = {
  accessArgument: (
    inputIndexVar: string,
  ) => `(${inputIndexVar} == 0 ? ${InjectedParam_InputStateProofs}[0] :
  (${inputIndexVar} == 1 ? ${InjectedParam_InputStateProofs}[1] :
  (${inputIndexVar} == 2 ? ${InjectedParam_InputStateProofs}[2] :
  (${inputIndexVar} == 3 ? ${InjectedParam_InputStateProofs}[3] :
  (${inputIndexVar} == 4 ? ${InjectedParam_InputStateProofs}[4] : ${InjectedParam_InputStateProofs}[5])))))`,
  accessThis: (
    inputIndexVar: string,
  ) => `(${inputIndexVar} == 0 ? this.${InjectedParam_InputStateProofs}[0] :
  (${inputIndexVar} == 1 ? this.${InjectedParam_InputStateProofs}[1] :
  (${inputIndexVar} == 2 ? this.${InjectedParam_InputStateProofs}[2] :
  (${inputIndexVar} == 3 ? this.${InjectedParam_InputStateProofs}[3] :
  (${inputIndexVar} == 4 ? this.${InjectedParam_InputStateProofs}[4] : this.${InjectedParam_InputStateProofs}[5])))))`,
};
