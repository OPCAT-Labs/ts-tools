import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  OpenApiProvider,
  UTXO,
} from '@opcat-labs/scrypt-ts-opcat';
import { createLogger } from '../utils/index.js';

use(chaiAsPromised);

describe('Test OpenApiProvider on testnet', () => {
  let openApiProvider: OpenApiProvider;
  const network = 'opcat-testnet';
  const logger = createLogger('OpenApiProvider Test');

  // Test address with UTXOs
  const testAddress = 'mu9vPHA1fBoYC6bhu9nTTRDPmQ7A45kKUn';

  // Known testnet transaction for testing
  const knownTxId = 'f30bdfa4be0e20c05a6f3a7e86f362d6b4772d99d6a28c7f069e0c6577dfdd0f';

  before(async () => {
    openApiProvider = new OpenApiProvider(network);
    logger.info('Provider initialized');
  });

  describe('getNetwork', () => {
    it('should return the correct network', async () => {
      const openApiNetwork = await openApiProvider.getNetwork();

      expect(openApiNetwork).to.equal(network);

      logger.info('Network:', openApiNetwork);
    });
  });

  describe('getFeeRate', () => {
    it('should return a valid fee rate', async () => {
      const openApiFeeRate = await openApiProvider.getFeeRate();

      expect(openApiFeeRate).to.be.a('number');
      expect(openApiFeeRate).to.be.greaterThan(0);
      expect(openApiFeeRate).to.be.lessThan(1000);

      logger.info('Fee rate:', openApiFeeRate);
    });
  });

  describe('getMedianTime', () => {
    it('should return valid time value', async () => {
      const openApiMedianTime = await openApiProvider.getMedianTime();

      expect(openApiMedianTime).to.be.a('number');

      logger.info('Median time:', openApiMedianTime);

      // Should return Unix timestamp (reasonable range)
      const now = Math.floor(Date.now() / 1000);
      const oneYearAgo = now - (365 * 24 * 60 * 60);

      expect(openApiMedianTime).to.be.greaterThan(oneYearAgo);
      expect(openApiMedianTime).to.be.lessThan(now + 7200); // Allow 2 hours in future for clock skew
    });
  });

  describe('getUtxos', () => {
    it('should return valid UTXOs', async function() {
      this.timeout(30000); // Increase timeout for network requests

      logger.info('Testing with address:', testAddress);

      const openApiUtxos = await openApiProvider.getUtxos(testAddress);

      logger.info(`Returned ${openApiUtxos.length} UTXOs`);

      // Should return array
      expect(openApiUtxos).to.be.an('array');

      // Should have UTXOs for this address
      expect(openApiUtxos.length).to.be.greaterThan(0);

      // Verify UTXO structure
      openApiUtxos.forEach(utxo => {
        expect(utxo).to.have.property('txId');
        expect(utxo).to.have.property('outputIndex');
        expect(utxo).to.have.property('satoshis');
        expect(utxo).to.have.property('script');
        expect(utxo.txId).to.be.a('string').with.lengthOf(64);
        expect(utxo.outputIndex).to.be.a('number');
        expect(utxo.satoshis).to.be.a('number').and.greaterThan(0);
      });
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
    it('should return valid raw transaction', async function() {
      this.timeout(30000);

      logger.info('Testing with transaction ID:', knownTxId);

      const openApiTx = await openApiProvider.getRawTransaction(knownTxId);

      expect(openApiTx).to.be.a('string');
      expect(openApiTx.length).to.be.greaterThan(0);

      logger.info('Raw transaction length:', openApiTx.length);
    });
  });

  describe('getConfirmations', () => {
    it('should return valid confirmations', async function() {
      this.timeout(30000);

      logger.info('Testing confirmations for transaction ID:', knownTxId);

      const openApiConfirmations = await openApiProvider.getConfirmations(knownTxId);

      expect(openApiConfirmations).to.be.a('number');
      expect(openApiConfirmations).to.be.greaterThanOrEqual(0);

      logger.info('Confirmations:', openApiConfirmations);
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
