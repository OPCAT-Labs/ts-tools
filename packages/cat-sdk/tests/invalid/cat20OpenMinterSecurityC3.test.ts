import { expect } from 'chai'
import { CAT20OpenMinter } from '../../src/contracts/cat20/minters/cat20OpenMinter'
import { myPrivateKey } from '../utils/privateKey'
import { toTokenOwnerAddress, outpoint2ByteString } from '../../src/utils'
import { toByteString } from '@opcat-labs/scrypt-ts-opcat'
import { ContractPeripheral } from '../../src/utils/contractPeripheral'
import { readArtifact } from '../utils/index'

/**
 * C.3 Security Test: Open Minter Premine Consistency
 *
 * This test verifies that the CAT20 open minter contract correctly enforces
 * premine-related constraints by removing the redundant premine parameter.
 *
 * The fix removes the premine parameter entirely - premine is now automatically
 * calculated as premineCount * limit, eliminating the possibility of inconsistency.
 */
describe('Test CAT20 Open Minter Security C.3: Premine Consistency', () => {

  before(async () => {
    CAT20OpenMinter.loadArtifact(
      readArtifact('artifacts/cat20/minters/cat20OpenMinter.json')
    )
  })

  describe('Invalid premine parameters should be rejected', () => {
    it('should reject when premineCount > maxCount', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // premineCount exceeds maxCount
      expect(() => {
        new CAT20OpenMinter(
          genesisOutpoint,
          100n,      // maxCount = 100
          150n,      // premineCount = 150 (WRONG! > maxCount)
          100n,      // limit = 100
          address
        )
      }).to.throw('premineCount must not exceed maxCount')
    })

    it('should reject when premineCount is negative', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // premineCount is negative
      expect(() => {
        new CAT20OpenMinter(
          genesisOutpoint,
          100n,      // maxCount = 100
          -1n,       // premineCount = -1 (WRONG!)
          100n,      // limit = 100
          address
        )
      }).to.throw('premineCount must be non-negative')
    })

    it('should reject when limit is zero', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // limit is zero
      expect(() => {
        new CAT20OpenMinter(
          genesisOutpoint,
          100n,      // maxCount = 100
          10n,       // premineCount = 10
          0n,        // limit = 0 (WRONG!)
          address
        )
      }).to.throw('limit must be greater than 0')
    })

    it('should reject when limit is negative', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // limit is negative
      expect(() => {
        new CAT20OpenMinter(
          genesisOutpoint,
          100n,      // maxCount = 100
          10n,       // premineCount = 10
          -100n,     // limit = -100 (WRONG!)
          address
        )
      }).to.throw('limit must be greater than 0')
    })
  })

  describe('Valid premine parameters should be accepted', () => {
    it('should accept when premineCount <= maxCount with premine', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // Correct parameters: premineCount=10, limit=100, maxCount=1000
      // premine = premineCount * limit = 10 * 100 = 1000
      const validOpenMinter = new CAT20OpenMinter(
        genesisOutpoint,
        1000n,     // maxCount
        10n,       // premineCount
        100n,      // limit
        address
      )

      const scriptHash = ContractPeripheral.scriptHash(validOpenMinter)
      expect(scriptHash).to.be.a('string')
      expect(scriptHash.length).to.equal(64)

      console.log('Valid open minter with correct premine parameters created successfully')
    })

    it('should accept when premine is 0 and premineCount is 0', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // No premine case: premineCount=0, so premine = 0 * 100 = 0
      const noPremineOpenMinter = new CAT20OpenMinter(
        genesisOutpoint,
        1000n,     // maxCount
        0n,        // premineCount
        100n,      // limit
        address
      )

      const scriptHash = ContractPeripheral.scriptHash(noPremineOpenMinter)
      expect(scriptHash).to.be.a('string')
      expect(scriptHash.length).to.equal(64)

      console.log('No-premine open minter created successfully')
    })

    it('should accept large but correct premine values', async () => {
      const address = toTokenOwnerAddress(myPrivateKey.toAddress().toString())
      const genesisOutpoint = outpoint2ByteString('0000000000000000000000000000000000000000000000000000000000000000_0')

      // Large premine case: premineCount=500, limit=1000000
      // premine = 500 * 1000000 = 500000000
      const largePremineOpenMinter = new CAT20OpenMinter(
        genesisOutpoint,
        1000n,           // maxCount
        500n,            // premineCount
        1000000n,        // limit (1M)
        address
      )

      const scriptHash = ContractPeripheral.scriptHash(largePremineOpenMinter)
      expect(scriptHash).to.be.a('string')
      expect(scriptHash.length).to.equal(64)

      console.log('Large premine open minter with correct parameters created successfully')
    })
  })
})
