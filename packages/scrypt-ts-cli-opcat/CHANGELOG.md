# @opcat-labs/cli-opcat

## 3.1.0

### Minor Changes

- remove MempoolProvider, add OpenApiProvider

### Patch Changes

- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@3.1.0

## 3.0.0

### Major Changes

- feat!: refactor preimage structure and implement checkDataSig

  ### Breaking Changes
  - **SHPreimage type refactored**: All fields restructured from old Tap Sighash format to new SH format
    - New fields: nVersion, hashPrevouts, spentScriptHash, spentDataHash, value, nSequence, hashSpentAmounts, hashSpentScriptHashes, hashSpentDataHashes, hashSequences, hashOutputs, inputIndex, nLockTime, sigHashType
  - **preimage.ts API changes**:
    - Removed: `splitSighashPreimage()`, `toSHPreimageObj()`, `shPreimageToSig()`, `shPreimageGetE()`
    - Removed constants: `PREIMAGE_PREFIX`, `E_PREIMAGE_PREFIX`, `GX`
    - Added: `decodeSHPreimage(preimage)` - decode binary preimage
    - Added: `encodeSHPreimage(shPreimage)` - encode SHPreimage
  - **checkSHPreimage verification flow changed**:
    - Old approach: `ContextUtils.checkSHPreimage()` + `checkSig()`
    - New approach: two-step verification - `checkDataSig()` + `checkSig()`
    - Signature now injected via `_injectedPreimageSig`

  ### New Features
  - **checkDataSig method**: Support for OP_CHECKSIGFROMSTACK (0xba) and OP_CHECKSIGFROMSTACKVERIFY (0xbb)
  - **New signing utility functions**:
    - `signPreimage(preimage, sigHashType)`
    - `signSHPreimage(shPreimage, sigHashType)`
    - `signDataForCheckDataSig(message)`
    - `signSHPreimageForCheckDataSig(shPreimage)`
    - `signData(privateKey, message)` - for Oracle scenarios
    - `signDataWithInternalKey()` - sign with internal key

  ### Migration Guide

  Code using preimage needs to be updated to adapt to the new structure and verification flow.

### Patch Changes

- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@3.0.0

## 2.1.3

### Patch Changes

- @opcat-labs/scrypt-ts-transpiler-opcat@2.1.3

## 2.1.2

### Patch Changes

- fix estimate fee return float number
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.1.2

## 2.1.1

### Patch Changes

- fix mempoolProvider getUtxos, fix mempoolProvider getConfirmations
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.1.1

## 2.1.0

### Minor Changes

- back to genesis now trace to genesis contract
- add dryRun for cat-sdk features
- add mergeSendToken feature for cat20
- lots of bugfixes

### Patch Changes

- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.1.0

## 2.0.2

### Patch Changes

- add more exports in cat-sdk
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.0.2

## 2.0.1

### Patch Changes

- fix: handle utxo.txHashPreimage in features
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.0.1

## 2.0.0

### Major Changes

- Release CAT721

### Patch Changes

- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@2.0.0

## 1.0.7

### Patch Changes

- @opcat-labs/scrypt-ts-transpiler-opcat@1.0.6

## 1.0.6

### Patch Changes

- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@1.0.5

## 1.0.5

### Patch Changes

- @opcat-labs/scrypt-ts-transpiler-opcat@1.0.4

## 1.0.4

### Patch Changes

- @opcat-labs/scrypt-ts-transpiler-opcat@1.0.3

## 1.0.3

### Patch Changes

- fix esm, fix change amount, add decodePubFunctionCall
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@1.0.2

## 1.0.2

### Patch Changes

- fix cli templates deploy.ts

## 1.0.1

### Patch Changes

- add cli project command
- Updated dependencies
  - @opcat-labs/scrypt-ts-transpiler-opcat@1.0.1
