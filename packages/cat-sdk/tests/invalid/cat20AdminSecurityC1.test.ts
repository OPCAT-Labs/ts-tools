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
import { CAT20, CAT20State, CAT20StateLib, CAT20GuardStateLib, GUARD_TOKEN_TYPE_MAX } from '../../src/contracts';
import { CAT20GuardPeripheral, ContractPeripheral } from '../../src/utils/contractPeripheral';
import { createCat20 } from '../utils/testCAT20Generator';
import { testSigner } from '../utils/testSigner';
import { applyFixedArray, getDummyUtxo, toTokenOwnerAddress } from '../../src/utils';
import { Postage } from '../../src/typeConstants';

use(chaiAsPromised);

/**
 * Test Suite for C.1 Security Vulnerability Fix
 *
 * C.1: Empty Admin Script Hash Allows Permissionless Admin Spend
 *
 * This test suite validates that the security fixes prevent:
 * 1. Deploying tokens with hasAdmin=true but empty adminScriptHash
 * 2. Deploying tokens with hasAdmin=true but adminScriptHash with wrong length
 *
 * The fixes are:
 * - Constructor validation: When hasAdmin=true, adminScriptHash must be exactly 32 bytes
 * - unlock() validation: For spendType 1/2, spendScriptInputIndex must be >= 0 and < inputCount
 */
isLocalTest(testProvider) && describe('Test C.1 - Admin Script Hash Security', () => {
  before(async () => {
    loadAllArtifacts();
  });

  describe('Constructor Validation - Empty Admin Script Hash Prevention', () => {
    it('should reject CAT20 deployment with hasAdmin=true but empty adminScriptHash', () => {
      // Use valid hex string for minterScriptHash
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // Attempt to create CAT20 with hasAdmin=true but adminScriptHash='' (empty)
      expect(() => {
        new CAT20(
          minterScriptHash,
          true,  // hasAdmin = true
          toByteString('')  // adminScriptHash = '' (empty, length 0)
        );
      }).to.throw('admin script hash must be 32 bytes when hasAdmin is true');
    });

    it('should reject CAT20 deployment with hasAdmin=true but adminScriptHash with 1 byte', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // Attempt to create CAT20 with hasAdmin=true but adminScriptHash with only 1 byte
      expect(() => {
        new CAT20(
          minterScriptHash,
          true,  // hasAdmin = true
          toByteString('00')  // adminScriptHash = 1 byte
        );
      }).to.throw('admin script hash must be 32 bytes when hasAdmin is true');
    });

    it('should reject CAT20 deployment with hasAdmin=true but adminScriptHash with 31 bytes', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // Create a 31-byte string (62 hex characters)
      const invalidAdminHash = toByteString('00'.repeat(31), true);

      expect(() => {
        new CAT20(
          minterScriptHash,
          true,  // hasAdmin = true
          invalidAdminHash  // adminScriptHash = 31 bytes (not 32)
        );
      }).to.throw('admin script hash must be 32 bytes when hasAdmin is true');
    });

    it('should reject CAT20 deployment with hasAdmin=true but adminScriptHash with 33 bytes', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // Create a 33-byte string (66 hex characters)
      const invalidAdminHash = toByteString('00'.repeat(33), true);

      expect(() => {
        new CAT20(
          minterScriptHash,
          true,  // hasAdmin = true
          invalidAdminHash  // adminScriptHash = 33 bytes (not 32)
        );
      }).to.throw('admin script hash must be 32 bytes when hasAdmin is true');
    });

    it('should accept CAT20 deployment with hasAdmin=false and empty adminScriptHash', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // This should succeed: hasAdmin=false allows empty adminScriptHash
      const cat20 = new CAT20(
        minterScriptHash,
        false,  // hasAdmin = false
        toByteString('')  // adminScriptHash = '' (allowed when hasAdmin=false)
      );

      expect(cat20.hasAdmin).to.be.false;
      expect(len(cat20.adminScriptHash)).to.equal(0n);
    });

    it('should reject CAT20 deployment with hasAdmin=false but non-empty adminScriptHash', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);

      // When hasAdmin=false, adminScriptHash must be empty
      expect(() => {
        new CAT20(
          minterScriptHash,
          false,  // hasAdmin = false
          toByteString('1234')  // adminScriptHash = 2 bytes (NOT allowed when hasAdmin=false)
        );
      }).to.throw('admin script hash must be empty when hasAdmin is false');
    });

    it('should accept CAT20 deployment with hasAdmin=true and valid 32-byte adminScriptHash (sha256)', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);
      // Create a valid 32-byte hash using sha256
      const validAdminHash = sha256(toByteString('01', true));

      const cat20 = new CAT20(
        minterScriptHash,
        true,  // hasAdmin = true
        validAdminHash  // Valid 32-byte hash
      );

      expect(cat20.hasAdmin).to.be.true;
      expect(len(cat20.adminScriptHash)).to.equal(32n);
    });

    it('should accept CAT20 deployment with hasAdmin=true and another valid 32-byte adminScriptHash', () => {
      const minterScriptHash = toByteString('0000000000000000000000000000000000000000000000000000000000000001', true);
      // Create another valid 32-byte hash using sha256
      const validAdminHash = sha256(toByteString('abcd1234', true));

      const cat20 = new CAT20(
        minterScriptHash,
        true,  // hasAdmin = true
        validAdminHash  // Valid 32-byte hash
      );

      expect(cat20.hasAdmin).to.be.true;
      expect(len(cat20.adminScriptHash)).to.equal(32n);
    });
  });

  describe('Additional Security Tests', () => {
    it('should validate that empty string is indeed 0 bytes', () => {
      const emptyString = toByteString('');
      expect(len(emptyString)).to.equal(0n);
    });

    it('should validate that sha256 always produces 32 bytes', () => {
      const hash1 = sha256(toByteString('00', true));
      const hash2 = sha256(toByteString('01', true));
      const hash3 = sha256(toByteString(''));

      expect(len(hash1)).to.equal(32n);
      expect(len(hash2)).to.equal(32n);
      expect(len(hash3)).to.equal(32n);
    });

    it('should verify guard variant script hashes are all 32 bytes', () => {
      const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes();

      guardScriptHashes.forEach((hash, index) => {
        expect(len(hash)).to.equal(32n, `Guard variant ${index} should be 32 bytes`);
      });
    });
  });

  describe('Unlock Method - Negative spendScriptInputIndex Prevention (C.1 & C.9)', () => {
    let mainAddress: string;
    let mainPubKey: PubKey;

    before(async () => {
      mainAddress = await testSigner.getAddress();
      mainPubKey = PubKey(await testSigner.getPublicKey());
    });

    it('should reject contract spend (spendType=1) with spendScriptInputIndex=-1', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_contract_neg1');

      return expect(
        attemptTransferWithInvalidIndex(cat20, mainAddress, mainPubKey, 1n, -1n)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex must be >= 0 for contract or admin spend'
      );
    });

    it('should reject admin spend (spendType=2) with spendScriptInputIndex=-1', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_admin_neg1');

      return expect(
        attemptTransferWithInvalidIndex(cat20, mainAddress, mainPubKey, 2n, -1n)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex must be >= 0 for contract or admin spend'
      );
    });

    it('should reject contract spend (spendType=1) with spendScriptInputIndex=-5', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_contract_neg5');

      return expect(
        attemptTransferWithInvalidIndex(cat20, mainAddress, mainPubKey, 1n, -5n)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex must be >= 0 for contract or admin spend'
      );
    });

    it('should reject admin spend (spendType=2) with spendScriptInputIndex=-10', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_admin_neg10');

      return expect(
        attemptTransferWithInvalidIndex(cat20, mainAddress, mainPubKey, 2n, -10n)
      ).to.eventually.be.rejectedWith(
        'spendScriptInputIndex must be >= 0 for contract or admin spend'
      );
    });

    it('should allow user spend (spendType=0) with spendScriptInputIndex=-1', async () => {
      const cat20 = await createCat20([1000n], mainAddress, 'test_user_ok');

      // User spend should succeed even with negative index (it's ignored)
      await attemptTransferWithInvalidIndex(cat20, mainAddress, mainPubKey, 0n, -1n);
    });
  });
});

/**
 * Helper function to attempt a transfer with invalid spendScriptInputIndex
 */
async function attemptTransferWithInvalidIndex(
  cat20: Awaited<ReturnType<typeof createCat20>>,
  mainAddress: string,
  mainPubKey: PubKey,
  spendType: bigint,
  invalidIndex: bigint
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

  // Get guardState from guard
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

  // Add CAT20 inputs with the invalid index
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
          spendScriptInputIndex: invalidIndex,  // INVALID INDEX - should fail for spendType 1/2
          spendType: spendType,  // 0=user, 1=contract, 2=admin
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

  // Add CAT20 output (AFTER guard input to match working pattern)
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
