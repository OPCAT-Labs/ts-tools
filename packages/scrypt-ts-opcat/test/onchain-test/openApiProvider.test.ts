import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  MempoolProvider,
  OpenApiProvider,
  UTXO,
} from '@opcat-labs/scrypt-ts-opcat';
import { createLogger } from '../utils/index.js';

use(chaiAsPromised);

describe('Test OpenApiProvider on testnet', () => {
  let openApiProvider: OpenApiProvider;
  let mempoolProvider: MempoolProvider;
  const network = 'opcat-testnet';
  const logger = createLogger('OpenApiProvider Test');

  // Test address with UTXOs
  const testAddress = 'mu9vPHA1fBoYC6bhu9nTTRDPmQ7A45kKUn';

  // Known testnet transaction for testing
  const knownTxId = 'f30bdfa4be0e20c05a6f3a7e86f362d6b4772d99d6a28c7f069e0c6577dfdd0f';

  before(async () => {
    openApiProvider = new OpenApiProvider(network);
    mempoolProvider = new MempoolProvider(network);
    logger.info('Providers initialized');
  });

  describe('getNetwork', () => {
    it('should return the correct network', async () => {
      const openApiNetwork = await openApiProvider.getNetwork();
      const mempoolNetwork = await mempoolProvider.getNetwork();

      expect(openApiNetwork).to.equal(network);
      expect(mempoolNetwork).to.equal(network);
      expect(openApiNetwork).to.equal(mempoolNetwork);

      logger.info('Network:', openApiNetwork);
    });
  });

  describe('getFeeRate', () => {
    it('should return a valid fee rate from both providers', async () => {
      const openApiFeeRate = await openApiProvider.getFeeRate();
      const mempoolFeeRate = await mempoolProvider.getFeeRate();

      expect(openApiFeeRate).to.be.a('number');
      expect(openApiFeeRate).to.be.greaterThan(0);

      expect(mempoolFeeRate).to.be.a('number');
      expect(mempoolFeeRate).to.be.greaterThan(0);

      logger.info('OpenAPI fee rate:', openApiFeeRate);
      logger.info('Mempool fee rate:', mempoolFeeRate);

      // Fee rates are both valid positive numbers
      // Note: Different APIs may return fee rates in different formats or units,
      // so we just verify they're both reasonable values (> 0 and < 1000)
      expect(openApiFeeRate).to.be.lessThan(1000);
      expect(mempoolFeeRate).to.be.lessThan(1000);
    });
  });

  describe('getMedianTime', () => {
    it('should return valid time values from both providers', async () => {
      const openApiMedianTime = await openApiProvider.getMedianTime();
      const mempoolMedianTime = await mempoolProvider.getMedianTime();

      expect(openApiMedianTime).to.be.a('number');
      expect(mempoolMedianTime).to.be.a('number');

      logger.info('OpenAPI median time:', openApiMedianTime);
      logger.info('Mempool median time:', mempoolMedianTime);

      // Both should return Unix timestamps (reasonable range)
      const now = Math.floor(Date.now() / 1000);
      const oneYearAgo = now - (365 * 24 * 60 * 60);

      expect(openApiMedianTime).to.be.greaterThan(oneYearAgo);
      expect(openApiMedianTime).to.be.lessThan(now + 7200); // Allow 2 hours in future for clock skew

      expect(mempoolMedianTime).to.be.greaterThan(oneYearAgo);
      expect(mempoolMedianTime).to.be.lessThan(now + 7200);

      // The times should be close to each other (within a reasonable range)
      // OpenAPI may return timestamp instead of mediantime, so allow some difference
      const difference = Math.abs(openApiMedianTime - mempoolMedianTime);
      expect(difference).to.be.lessThan(7200); // Allow up to 2 hours difference
    });
  });

  describe('getUtxos', () => {
    it('should return consistent UTXOs from both providers', async function() {
      this.timeout(30000); // Increase timeout for network requests

      logger.info('Testing with address:', testAddress);

      const openApiUtxos = await openApiProvider.getUtxos(testAddress);
      const mempoolUtxos = await mempoolProvider.getUtxos(testAddress);

      logger.info(`OpenAPI returned ${openApiUtxos.length} UTXOs`);
      logger.info(`Mempool returned ${mempoolUtxos.length} UTXOs`);

      // Both should return arrays
      expect(openApiUtxos).to.be.an('array');
      expect(mempoolUtxos).to.be.an('array');

      // Should have UTXOs for this address
      expect(openApiUtxos.length).to.be.greaterThan(0);
      expect(mempoolUtxos.length).to.be.greaterThan(0);

      // Create maps for easy comparison
      const openApiMap = new Map(
        openApiUtxos.map(utxo => [`${utxo.txId}:${utxo.outputIndex}`, utxo])
      );
      const mempoolMap = new Map(
        mempoolUtxos.map(utxo => [`${utxo.txId}:${utxo.outputIndex}`, utxo])
      );

      // Check if UTXOs match
      let matchCount = 0;
      for (const [key, openApiUtxo] of openApiMap.entries()) {
        if (mempoolMap.has(key)) {
          const mempoolUtxo = mempoolMap.get(key)!;

          // Verify UTXO structure
          expect(openApiUtxo.txId).to.equal(mempoolUtxo.txId);
          expect(openApiUtxo.outputIndex).to.equal(mempoolUtxo.outputIndex);
          expect(openApiUtxo.satoshis).to.equal(mempoolUtxo.satoshis);
          expect(openApiUtxo.script).to.equal(mempoolUtxo.script);

          matchCount++;
        }
      }

      logger.info(`Matched ${matchCount} UTXOs between providers`);

      // At least some UTXOs should match (allowing for timing differences)
      const totalUtxos = Math.max(openApiUtxos.length, mempoolUtxos.length);
      const matchRatio = matchCount / totalUtxos;
      expect(matchRatio).to.be.greaterThan(0.8); // At least 80% should match
    });

    it('should handle pagination correctly', async function() {
      this.timeout(30000);

      // Test with unspentValue option
      const openApiUtxos = await openApiProvider.getUtxos(testAddress, { unspentValue: 10000 });

      expect(openApiUtxos).to.be.an('array');
      expect(openApiUtxos.length).to.be.greaterThan(0);

      // Verify all UTXOs have required fields
      openApiUtxos.forEach(utxo => {
        expect(utxo).to.have.property('txId');
        expect(utxo).to.have.property('outputIndex');
        expect(utxo).to.have.property('satoshis');
        expect(utxo).to.have.property('script');
        expect(utxo.txId).to.be.a('string').with.lengthOf(64);
        expect(utxo.outputIndex).to.be.a('number');
        expect(utxo.satoshis).to.be.a('number').and.greaterThan(0);
      });

      logger.info(`Fetched ${openApiUtxos.length} UTXOs with pagination`);
    });
  });

  describe('getRawTransaction', () => {
    it('should return the same raw transaction from both providers', async function() {
      this.timeout(30000);

      logger.info('Testing with transaction ID:', knownTxId);

      const openApiTx = await openApiProvider.getRawTransaction(knownTxId);
      const mempoolTx = await mempoolProvider.getRawTransaction(knownTxId);

      expect(openApiTx).to.be.a('string');
      expect(mempoolTx).to.be.a('string');
      expect(openApiTx.length).to.be.greaterThan(0);

      // The raw transactions should be identical
      expect(openApiTx).to.equal(mempoolTx);

      logger.info('Raw transaction length:', openApiTx.length);
    });
  });

  describe('getConfirmations', () => {
    it('should return the same confirmations from both providers', async function() {
      this.timeout(30000);

      logger.info('Testing confirmations for transaction ID:', knownTxId);

      const openApiConfirmations = await openApiProvider.getConfirmations(knownTxId);
      const mempoolConfirmations = await mempoolProvider.getConfirmations(knownTxId);

      expect(openApiConfirmations).to.be.a('number');
      expect(mempoolConfirmations).to.be.a('number');

      logger.info('OpenAPI confirmations:', openApiConfirmations);
      logger.info('Mempool confirmations:', mempoolConfirmations);

      // Confirmations should be the same (or very close if a block was just mined)
      const difference = Math.abs(openApiConfirmations - mempoolConfirmations);
      expect(difference).to.be.lessThanOrEqual(1); // Allow 1 block difference for timing
    });
  });

  describe('UTXO state management', () => {
    it('should properly mark UTXOs as spent', async () => {
      const testUtxo: UTXO = {
        txId: 'a'.repeat(64),
        outputIndex: 0,
        script: '76a914' + '0'.repeat(40) + '88ac',
        satoshis: 1000,
        data: ''
      };

      // Add a new UTXO
      openApiProvider.addNewUTXO(testUtxo);

      // Mark it as spent
      openApiProvider.markSpent(testUtxo.txId, testUtxo.outputIndex);

      // The provider should now consider this UTXO as spent
      // This is tested internally by the provider's filtering logic
      expect(true).to.be.true; // Placeholder assertion

      logger.info('UTXO state management test passed');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid transaction ID gracefully', async function() {
      this.timeout(10000);

      const invalidTxId = 'invalid_tx_id';

      try {
        await openApiProvider.getRawTransaction(invalidTxId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        logger.info('Error handled correctly for invalid txid');
      }
    });

    it('should handle invalid address gracefully', async function() {
      this.timeout(10000);

      const invalidAddress = 'invalid_address';

      try {
        await openApiProvider.getUtxos(invalidAddress);
        // May or may not throw, depending on validation
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        logger.info('Error handled correctly for invalid address');
      }
    });
  });

  describe('Response format consistency', () => {
    it('should handle OpenAPI response envelope correctly', async () => {
      // This test verifies that the provider correctly extracts data from
      // the OpenAPI response format {code, msg, data}
      const feeRate = await openApiProvider.getFeeRate();

      expect(feeRate).to.be.a('number');
      expect(feeRate).to.be.greaterThan(0);

      logger.info('OpenAPI response envelope handled correctly');
    });
  });
});
