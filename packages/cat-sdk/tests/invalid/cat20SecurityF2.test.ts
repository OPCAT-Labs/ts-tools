import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import {
  sha256,
  toByteString,
  len,
  ExtPsbt,
  PubKey,
  getBackTraceInfo,
  fill,
  toHex,
  uint8ArrayToHex,
} from '@opcat-labs/scrypt-ts-opcat';
import { CAT20, CAT20State, CAT20StateLib, GUARD_TOKEN_TYPE_MAX } from '../../src/contracts';
import { CAT20GuardPeripheral, ContractPeripheral } from '../../src/utils/contractPeripheral';
import { createCat20 } from '../utils/testCAT20Generator';
import { testSigner } from '../utils/testSigner';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';
import { singleSend } from '../../src/features/cat20/send/singleSend';

use(chaiAsPromised);

/**
 * Test Suite for F.2 Security Vulnerability Fix
 *
 * F.2: CAT20 Contract Owner Authorization Based Only on Script Hash
 *
 * This test suite validates that the security fixes prevent:
 * 1. Self-reference attack: spendScriptInputIndex pointing to the token input itself
 * 2. Instance confusion attack: spendScriptInputIndex pointing to the guard input
 * 3. Clone attack: Any UTXO with the same script hash could authorize the spend
 *
 * The fixes are:
 * - unlock() validation: spendScriptInputIndex cannot equal current token input index
 * - unlock() validation: spendScriptInputIndex cannot equal guard input index
 */
isLocalTest(testProvider) && describe('Test F.2 - Contract Owner Authorization Security', () => {
  before(async () => {
    loadAllArtifacts();
  });

  describe('Self-Reference Attack Prevention', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
      mainAddress = await testSigner.getAddress();
      mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should reject contract spend (spendType=1) when spendScriptInputIndex points to self', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_self_ref');

      // First, transfer token to token's own script hash to set up the attack scenario
      const tokenScriptHash = ContractPeripheral.scriptHash(cat20.utxos[0].script);
      const { sendPsbt } = await singleSend(
        testSigner,
        testProvider,
        cat20.generator.minterScriptHash,
        cat20.utxos,
        [{ address: tokenScriptHash, amount: 1000n }],
        toTokenOwnerAddress(mainAddress),
        await testProvider.getFeeRate(),
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      // Update cat20 with the new UTXO that has ownerAddr = tokenScriptHash
      const newUtxo = sendPsbt.getUtxo(0);
      cat20.utxos = [newUtxo];

      // Update trace info for the new UTXO
      cat20.utxoTraces = await CAT20GuardPeripheral.getBackTraceInfo(
        cat20.generator.minterScriptHash,
        [newUtxo],
        testProvider,
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      return expect(
        attemptTransferWithSelfReference(cat20, mainAddress, mainPubKey, 0)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex cannot reference self'
      );
    });

    it('should reject admin spend (spendType=2) when spendScriptInputIndex points to self', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_self_ref_admin');

      return expect(
        attemptAdminTransferWithSelfReference(cat20, mainAddress, mainPubKey, 0)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex cannot reference self'
      );
    });

    it('should reject when multiple tokens and spendScriptInputIndex points to second token', async () => {
      const cat20 = await createCat20([500n, 500n], mainAddress, 'test_multi_self_ref');

      // First, transfer tokens to token's own script hash
      const tokenScriptHash = ContractPeripheral.scriptHash(cat20.utxos[0].script);
      const { sendPsbt } = await singleSend(
        testSigner,
        testProvider,
        cat20.generator.minterScriptHash,
        cat20.utxos,
        [{ address: tokenScriptHash, amount: 1000n }],
        toTokenOwnerAddress(mainAddress),
        await testProvider.getFeeRate(),
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      // Update cat20 with the new UTXO
      const newUtxo = sendPsbt.getUtxo(0);
      cat20.utxos = [newUtxo];

      // Update trace info for the new UTXO
      cat20.utxoTraces = await CAT20GuardPeripheral.getBackTraceInfo(
        cat20.generator.minterScriptHash,
        [newUtxo],
        testProvider,
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      return expect(
        attemptTransferWithSelfReference(cat20, mainAddress, mainPubKey, 0)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex cannot reference self'
      );
    });
  });

  describe('Guard Reference Attack Prevention', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
      mainAddress = await testSigner.getAddress();
      mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should reject contract spend when spendScriptInputIndex points to guard', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_guard_ref');

      // First, get a guard script hash to transfer token to
      const guardOwnerAddr = toTokenOwnerAddress(mainAddress);
      const receivers = [{ address: guardOwnerAddr, amount: 1000n, outputIndex: 0 }];
      const txInputCount = cat20.utxos.length + 2;
      const txOutputCount = 2;

      const { guard } = CAT20GuardPeripheral.createTransferGuard(
        cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
        receivers,
        txInputCount,
        txOutputCount
      );

      const guardScriptHash = ContractPeripheral.scriptHash(guard.lockingScript.toHex());

      // Transfer token to guard's script hash
      const { sendPsbt } = await singleSend(
        testSigner,
        testProvider,
        cat20.generator.minterScriptHash,
        cat20.utxos,
        [{ address: guardScriptHash, amount: 1000n }],
        toTokenOwnerAddress(mainAddress),
        await testProvider.getFeeRate(),
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      // Update cat20 with the new UTXO that has ownerAddr = guardScriptHash
      const newUtxo = sendPsbt.getUtxo(0)
      cat20.utxos = [newUtxo];

      // Update trace info for the new UTXO
      cat20.utxoTraces = await CAT20GuardPeripheral.getBackTraceInfo(
        cat20.generator.minterScriptHash,
        [newUtxo],
        testProvider,
        cat20.generator.deployInfo.hasAdmin,
        cat20.generator.deployInfo.adminScriptHash
      );

      return expect(
        attemptTransferWithGuardReference(cat20, mainAddress, mainPubKey)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex cannot reference guard'
      );
    });

    it('should reject admin spend when spendScriptInputIndex points to guard', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_guard_ref_admin');

      return expect(
        attemptAdminTransferWithGuardReference(cat20, mainAddress, mainPubKey)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex cannot reference guard'
      );
    });
  });

  describe('Valid Contract Spend (Control Tests)', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
      mainAddress = await testSigner.getAddress();
      mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should allow user spend (spendType=0) - guard reference check does not apply', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_user_ok');

      // User spend should succeed even though we're not checking spendScriptInputIndex
      // because spendType=0 doesn't use spendScriptInputIndex at all
      await attemptUserTransfer(cat20, mainAddress, mainPubKey);
    });
  });
});

/**
 * Helper function to attempt a transfer with self-reference attack
 * spendScriptInputIndex points to the token input itself
 */
async function attemptTransferWithSelfReference(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey,
  tokenInputIndex: number
) {
  const totalAmount = cat20.utxos.reduce(
    (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
    0n
  );
  const guardOwnerAddr = toTokenOwnerAddress(mainAddress);

  const receivers = [{ address: guardOwnerAddr, amount: totalAmount, outputIndex: 0 }];
  const txInputCount = cat20.utxos.length + 2;
  const txOutputCount = 2;

  const { tokenAmounts, tokenBurnAmounts, guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
    cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
    receivers,
    txInputCount,
    txOutputCount
  );

  const guardState = guard.state;

  // Deploy guard
  {
    const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
      .spendUTXO(getDummyUtxo(mainAddress))
      .addContractOutput(guard, 1e8);
    const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  const guardInputIndex = cat20.utxos.length;
  const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

  // Add CAT20 inputs - F2 Attack: set spendScriptInputIndex to point to itself
  cat20.utxos.forEach((utxo, inputIndex) => {
    const cat20Contract = new CAT20(
      cat20.generator.minterScriptHash,
      cat20.generator.deployInfo.hasAdmin,
      cat20.generator.deployInfo.adminScriptHash
    ).bindToUtxo(utxo);

    psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
      contract.unlock(
        {
          userPubKey: mainPubKey,
          userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
          spendScriptInputIndex: BigInt(tokenInputIndex),  // F2 ATTACK: pointing to token itself
          spendType: 1n,  // contract spend
        },
        guardState,
        BigInt(guardInputIndex),
        getBackTraceInfo(
          cat20.utxoTraces[inputIndex].prevTxHex,
          cat20.utxoTraces[inputIndex].prevPrevTxHex,
          cat20.utxoTraces[inputIndex].prevTxInput
        )
      );
    });
  });

  // Add guard input
  psbt.addContractInput(guard, (contract, curPsbt) => {
    const cat20OutputStartIndex = 0;
    const cat20InputStartIndex = 0;
    const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
    {
      const outputScriptHashes = curPsbt.txOutputs.map((output) =>
        toByteString(sha256(uint8ArrayToHex(output.script)))
      );
      applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
      applyFixedArray(ownerAddrOrScripts, [guardOwnerAddr], cat20OutputStartIndex);
    }

    const outputTokens = fill(0n, txOutputCountMax);
    applyFixedArray(outputTokens, [totalAmount], cat20OutputStartIndex);

    const tokenScriptIndexes = fill(-1n, txOutputCountMax);
    applyFixedArray(tokenScriptIndexes, [0n], cat20OutputStartIndex);

    const outputSatoshis = fill(0n, txOutputCountMax);
    applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));

    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
    const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
    applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);

    const outputCount = curPsbt.txOutputs.length;
    const nextStateHashes = fill(toByteString(''), txOutputCountMax);
    applyFixedArray(
      nextStateHashes,
      curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
    );

    contract.unlock(
      tokenAmounts,
      tokenBurnAmounts,
      nextStateHashes,
      ownerAddrOrScripts,
      outputTokens,
      tokenScriptIndexes,
      outputSatoshis,
      cat20States,
      BigInt(outputCount)
    );
  });

  // Add CAT20 output
  const outputState: CAT20State = {
    ownerAddr: guardOwnerAddr,
    amount: totalAmount,
  };

  const cat20OutputContract = new CAT20(
    cat20.generator.minterScriptHash,
    cat20.generator.deployInfo.hasAdmin,
    cat20.generator.deployInfo.adminScriptHash
  );
  cat20OutputContract.state = outputState;
  psbt.addContractOutput(cat20OutputContract, Postage.TOKEN_POSTAGE);

  psbt.change(mainAddress, 0);

  const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  expect(psbt.isFinalized).to.be.true;
}

/**
 * Helper function to attempt a transfer with guard reference attack
 * spendScriptInputIndex points to the guard input
 */
async function attemptTransferWithGuardReference(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey
) {
  const totalAmount = cat20.utxos.reduce(
    (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
    0n
  );
  const guardOwnerAddr = toTokenOwnerAddress(mainAddress);

  const receivers = [{ address: guardOwnerAddr, amount: totalAmount, outputIndex: 0 }];
  const txInputCount = cat20.utxos.length + 2;
  const txOutputCount = 2;

  const { tokenAmounts, tokenBurnAmounts, guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
    cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
    receivers,
    txInputCount,
    txOutputCount
  );

  const guardState = guard.state;

  // Deploy guard
  {
    const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
      .spendUTXO(getDummyUtxo(mainAddress))
      .addContractOutput(guard, 1e8);
    const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  const guardInputIndex = cat20.utxos.length;
  const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

  // Add CAT20 inputs - F2 Attack: set spendScriptInputIndex to point to guard
  cat20.utxos.forEach((utxo, inputIndex) => {
    const cat20Contract = new CAT20(
      cat20.generator.minterScriptHash,
      cat20.generator.deployInfo.hasAdmin,
      cat20.generator.deployInfo.adminScriptHash
    ).bindToUtxo(utxo);

    psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
      contract.unlock(
        {
          userPubKey: mainPubKey,
          userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
          spendScriptInputIndex: BigInt(guardInputIndex),  // F2 ATTACK: pointing to guard
          spendType: 1n,  // contract spend
        },
        guardState,
        BigInt(guardInputIndex),
        getBackTraceInfo(
          cat20.utxoTraces[inputIndex].prevTxHex,
          cat20.utxoTraces[inputIndex].prevPrevTxHex,
          cat20.utxoTraces[inputIndex].prevTxInput
        )
      );
    });
  });

  // Add guard input
  psbt.addContractInput(guard, (contract, curPsbt) => {
    const cat20OutputStartIndex = 0;
    const cat20InputStartIndex = 0;
    const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
    {
      const outputScriptHashes = curPsbt.txOutputs.map((output) =>
        toByteString(sha256(uint8ArrayToHex(output.script)))
      );
      applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
      applyFixedArray(ownerAddrOrScripts, [guardOwnerAddr], cat20OutputStartIndex);
    }

    const outputTokens = fill(0n, txOutputCountMax);
    applyFixedArray(outputTokens, [totalAmount], cat20OutputStartIndex);

    const tokenScriptIndexes = fill(-1n, txOutputCountMax);
    applyFixedArray(tokenScriptIndexes, [0n], cat20OutputStartIndex);

    const outputSatoshis = fill(0n, txOutputCountMax);
    applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));

    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
    const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
    applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);

    const outputCount = curPsbt.txOutputs.length;
    const nextStateHashes = fill(toByteString(''), txOutputCountMax);
    applyFixedArray(
      nextStateHashes,
      curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
    );

    contract.unlock(
      tokenAmounts,
      tokenBurnAmounts,
      nextStateHashes,
      ownerAddrOrScripts,
      outputTokens,
      tokenScriptIndexes,
      outputSatoshis,
      cat20States,
      BigInt(outputCount)
    );
  });

  // Add CAT20 output
  const outputState: CAT20State = {
    ownerAddr: guardOwnerAddr,
    amount: totalAmount,
  };

  const cat20OutputContract = new CAT20(
    cat20.generator.minterScriptHash,
    cat20.generator.deployInfo.hasAdmin,
    cat20.generator.deployInfo.adminScriptHash
  );
  cat20OutputContract.state = outputState;
  psbt.addContractOutput(cat20OutputContract, Postage.TOKEN_POSTAGE);

  psbt.change(mainAddress, 0);

  const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  expect(psbt.isFinalized).to.be.true;
}

/**
 * Helper function for admin spend with self-reference
 */
async function attemptAdminTransferWithSelfReference(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey,
  tokenInputIndex: number
) {
  const totalAmount = cat20.utxos.reduce(
    (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
    0n
  );
  const guardOwnerAddr = toTokenOwnerAddress(mainAddress);

  const receivers = [{ address: guardOwnerAddr, amount: totalAmount, outputIndex: 0 }];
  const txInputCount = cat20.utxos.length + 2;
  const txOutputCount = 2;

  const { tokenAmounts, tokenBurnAmounts, guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
    cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
    receivers,
    txInputCount,
    txOutputCount
  );

  const guardState = guard.state;

  // Deploy guard
  {
    const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
      .spendUTXO(getDummyUtxo(mainAddress))
      .addContractOutput(guard, 1e8);
    const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  const guardInputIndex = cat20.utxos.length;
  const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

  // Add CAT20 inputs with admin spend type
  cat20.utxos.forEach((utxo, inputIndex) => {
    const cat20Contract = new CAT20(
      cat20.generator.minterScriptHash,
      cat20.generator.deployInfo.hasAdmin,
      cat20.generator.deployInfo.adminScriptHash
    ).bindToUtxo(utxo);

    psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
      contract.unlock(
        {
          userPubKey: mainPubKey,
          userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
          spendScriptInputIndex: BigInt(tokenInputIndex),  // F2 ATTACK: pointing to itself
          spendType: 2n,  // admin spend
        },
        guardState,
        BigInt(guardInputIndex),
        getBackTraceInfo(
          cat20.utxoTraces[inputIndex].prevTxHex,
          cat20.utxoTraces[inputIndex].prevPrevTxHex,
          cat20.utxoTraces[inputIndex].prevTxInput
        )
      );
    });
  });

  // Add guard and outputs (same as before)
  psbt.addContractInput(guard, (contract, curPsbt) => {
    const cat20OutputStartIndex = 0;
    const cat20InputStartIndex = 0;
    const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
    {
      const outputScriptHashes = curPsbt.txOutputs.map((output) =>
        toByteString(sha256(uint8ArrayToHex(output.script)))
      );
      applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
      applyFixedArray(ownerAddrOrScripts, [guardOwnerAddr], cat20OutputStartIndex);
    }

    const outputTokens = fill(0n, txOutputCountMax);
    applyFixedArray(outputTokens, [totalAmount], cat20OutputStartIndex);

    const tokenScriptIndexes = fill(-1n, txOutputCountMax);
    applyFixedArray(tokenScriptIndexes, [0n], cat20OutputStartIndex);

    const outputSatoshis = fill(0n, txOutputCountMax);
    applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));

    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
    const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
    applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);

    const outputCount = curPsbt.txOutputs.length;
    const nextStateHashes = fill(toByteString(''), txOutputCountMax);
    applyFixedArray(
      nextStateHashes,
      curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
    );

    contract.unlock(
      tokenAmounts,
      tokenBurnAmounts,
      nextStateHashes,
      ownerAddrOrScripts,
      outputTokens,
      tokenScriptIndexes,
      outputSatoshis,
      cat20States,
      BigInt(outputCount)
    );
  });

  const outputState: CAT20State = {
    ownerAddr: guardOwnerAddr,
    amount: totalAmount,
  };

  const cat20OutputContract = new CAT20(
    cat20.generator.minterScriptHash,
    cat20.generator.deployInfo.hasAdmin,
    cat20.generator.deployInfo.adminScriptHash
  );
  cat20OutputContract.state = outputState;
  psbt.addContractOutput(cat20OutputContract, Postage.TOKEN_POSTAGE);

  psbt.change(mainAddress, 0);

  const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  expect(psbt.isFinalized).to.be.true;
}

/**
 * Helper function for admin spend with guard reference
 */
async function attemptAdminTransferWithGuardReference(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey
) {
  const totalAmount = cat20.utxos.reduce(
    (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
    0n
  );
  const guardOwnerAddr = toTokenOwnerAddress(mainAddress);

  const receivers = [{ address: guardOwnerAddr, amount: totalAmount, outputIndex: 0 }];
  const txInputCount = cat20.utxos.length + 2;
  const txOutputCount = 2;

  const { tokenAmounts, tokenBurnAmounts, guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
    cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
    receivers,
    txInputCount,
    txOutputCount
  );

  const guardState = guard.state;
  const guardInputIndex = cat20.utxos.length;

  // Deploy guard
  {
    const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
      .spendUTXO(getDummyUtxo(mainAddress))
      .addContractOutput(guard, 1e8);
    const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

  cat20.utxos.forEach((utxo, inputIndex) => {
    const cat20Contract = new CAT20(
      cat20.generator.minterScriptHash,
      cat20.generator.deployInfo.hasAdmin,
      cat20.generator.deployInfo.adminScriptHash
    ).bindToUtxo(utxo);

    psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
      contract.unlock(
        {
          userPubKey: mainPubKey,
          userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
          spendScriptInputIndex: BigInt(guardInputIndex),  // F2 ATTACK: pointing to guard
          spendType: 2n,  // admin spend
        },
        guardState,
        BigInt(guardInputIndex),
        getBackTraceInfo(
          cat20.utxoTraces[inputIndex].prevTxHex,
          cat20.utxoTraces[inputIndex].prevPrevTxHex,
          cat20.utxoTraces[inputIndex].prevTxInput
        )
      );
    });
  });

  psbt.addContractInput(guard, (contract, curPsbt) => {
    const cat20OutputStartIndex = 0;
    const cat20InputStartIndex = 0;
    const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
    {
      const outputScriptHashes = curPsbt.txOutputs.map((output) =>
        toByteString(sha256(uint8ArrayToHex(output.script)))
      );
      applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
      applyFixedArray(ownerAddrOrScripts, [guardOwnerAddr], cat20OutputStartIndex);
    }

    const outputTokens = fill(0n, txOutputCountMax);
    applyFixedArray(outputTokens, [totalAmount], cat20OutputStartIndex);

    const tokenScriptIndexes = fill(-1n, txOutputCountMax);
    applyFixedArray(tokenScriptIndexes, [0n], cat20OutputStartIndex);

    const outputSatoshis = fill(0n, txOutputCountMax);
    applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));

    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
    const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
    applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);

    const outputCount = curPsbt.txOutputs.length;
    const nextStateHashes = fill(toByteString(''), txOutputCountMax);
    applyFixedArray(
      nextStateHashes,
      curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
    );

    contract.unlock(
      tokenAmounts,
      tokenBurnAmounts,
      nextStateHashes,
      ownerAddrOrScripts,
      outputTokens,
      tokenScriptIndexes,
      outputSatoshis,
      cat20States,
      BigInt(outputCount)
    );
  });

  const outputState: CAT20State = {
    ownerAddr: guardOwnerAddr,
    amount: totalAmount,
  };

  const cat20OutputContract = new CAT20(
    cat20.generator.minterScriptHash,
    cat20.generator.deployInfo.hasAdmin,
    cat20.generator.deployInfo.adminScriptHash
  );
  cat20OutputContract.state = outputState;
  psbt.addContractOutput(cat20OutputContract, Postage.TOKEN_POSTAGE);

  psbt.change(mainAddress, 0);

  const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  expect(psbt.isFinalized).to.be.true;
}

/**
 * Helper function for valid user transfer (control test)
 */
async function attemptUserTransfer(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey
) {
  const totalAmount = cat20.utxos.reduce(
    (acc, utxo) => acc + CAT20.deserializeState(utxo.data).amount,
    0n
  );
  const guardOwnerAddr = toTokenOwnerAddress(mainAddress);

  const receivers = [{ address: guardOwnerAddr, amount: totalAmount, outputIndex: 0 }];
  const txInputCount = cat20.utxos.length + 2;
  const txOutputCount = 2;

  const { tokenAmounts, tokenBurnAmounts, guard, txInputCountMax, txOutputCountMax } = CAT20GuardPeripheral.createTransferGuard(
    cat20.utxos.map((utxo, index) => ({ token: utxo, inputIndex: index })),
    receivers,
    txInputCount,
    txOutputCount
  );

  const guardState = guard.state;

  // Deploy guard
  {
    const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
      .spendUTXO(getDummyUtxo(mainAddress))
      .addContractOutput(guard, 1e8);
    const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
    psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  }

  const guardInputIndex = cat20.utxos.length;
  const psbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 });

  // Add CAT20 inputs with user spend (spendType=0)
  cat20.utxos.forEach((utxo, inputIndex) => {
    const cat20Contract = new CAT20(
      cat20.generator.minterScriptHash,
      cat20.generator.deployInfo.hasAdmin,
      cat20.generator.deployInfo.adminScriptHash
    ).bindToUtxo(utxo);

    psbt.addContractInput(cat20Contract, (contract, curPsbt) => {
      contract.unlock(
        {
          userPubKey: mainPubKey,
          userSig: curPsbt.getSig(inputIndex, { address: mainAddress }),
          spendScriptInputIndex: -1n,  // Not used for user spend
          spendType: 0n,  // user spend
        },
        guardState,
        BigInt(guardInputIndex),
        getBackTraceInfo(
          cat20.utxoTraces[inputIndex].prevTxHex,
          cat20.utxoTraces[inputIndex].prevPrevTxHex,
          cat20.utxoTraces[inputIndex].prevTxInput
        )
      );
    });
  });

  // Add guard input
  psbt.addContractInput(guard, (contract, curPsbt) => {
    const cat20OutputStartIndex = 0;
    const cat20InputStartIndex = 0;
    const ownerAddrOrScripts = fill(toByteString(''), txOutputCountMax);
    {
      const outputScriptHashes = curPsbt.txOutputs.map((output) =>
        toByteString(sha256(uint8ArrayToHex(output.script)))
      );
      applyFixedArray(ownerAddrOrScripts, outputScriptHashes, cat20OutputStartIndex);
      applyFixedArray(ownerAddrOrScripts, [guardOwnerAddr], cat20OutputStartIndex);
    }

    const outputTokens = fill(0n, txOutputCountMax);
    applyFixedArray(outputTokens, [totalAmount], cat20OutputStartIndex);

    const tokenScriptIndexes = fill(-1n, txOutputCountMax);
    applyFixedArray(tokenScriptIndexes, [0n], cat20OutputStartIndex);

    const outputSatoshis = fill(0n, txOutputCountMax);
    applyFixedArray(outputSatoshis, curPsbt.txOutputs.map((output) => BigInt(output.value)));

    const cat20States = fill(CAT20StateLib.create(0n, toByteString('')), txInputCountMax);
    const inputCat20States = cat20.utxos.map((utxo) => CAT20.deserializeState(utxo.data));
    applyFixedArray(cat20States, inputCat20States, cat20InputStartIndex);

    const outputCount = curPsbt.txOutputs.length;
    const nextStateHashes = fill(toByteString(''), txOutputCountMax);
    applyFixedArray(
      nextStateHashes,
      curPsbt.txOutputs.map((output) => sha256(toHex(output.data)))
    );

    contract.unlock(
      tokenAmounts,
      tokenBurnAmounts,
      nextStateHashes,
      ownerAddrOrScripts,
      outputTokens,
      tokenScriptIndexes,
      outputSatoshis,
      cat20States,
      BigInt(outputCount)
    );
  });

  // Add CAT20 output
  const outputState: CAT20State = {
    ownerAddr: guardOwnerAddr,
    amount: totalAmount,
  };

  const cat20OutputContract = new CAT20(
    cat20.generator.minterScriptHash,
    cat20.generator.deployInfo.hasAdmin,
    cat20.generator.deployInfo.adminScriptHash
  );
  cat20OutputContract.state = outputState;
  psbt.addContractOutput(cat20OutputContract, Postage.TOKEN_POSTAGE);

  psbt.change(mainAddress, 0);

  const signedPsbtHex = await testSigner.signPsbt(psbt.seal().toHex(), psbt.psbtOptions());
  psbt.combine(ExtPsbt.fromHex(signedPsbtHex)).finalizeAllInputs();
  expect(psbt.isFinalized).to.be.true;
}
