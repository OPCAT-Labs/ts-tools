import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { TestCAT721Generator } from '../../../utils/testCAT721Generator'
import { ClosedMinterCAT721Meta, ConstantsLib } from '../../../../src/contracts'
import { testSigner } from '../../../utils/testSigner'
import { loadAllArtifacts } from '../utils'
import { toTokenOwnerAddress } from '../../../../src/utils'
import { UTXO } from '@opcat-labs/scrypt-ts-opcat'
import { singleSendNft } from '../../../../src/features/cat721/send/singleSend'
import { testProvider } from '../../../utils/testProvider'
import { verifyTx } from '../../../utils'
use(chaiAsPromised)

describe('Test the feature `send` for `CAT721`', () => {
    let nftGenerator: TestCAT721Generator
    let metadata: ClosedMinterCAT721Meta
    let address: string;

    before(async () => {
        loadAllArtifacts()
        address = await testSigner.getAddress()
        metadata = {
            name: 'c',
            symbol: 'C',
            description: 'c',
            max: 2100n,
            icon: '',
            minterMd5: '',
            issuerAddress: toTokenOwnerAddress(address),
        }
        nftGenerator = await TestCAT721Generator.init(metadata)
    })


    const getNftUtxos = async function (
        generator: TestCAT721Generator,
        toReceiverAddr: string,
        n: number
    ) {
        const r: UTXO[] = []
        for (let index = 0; index < n; index++) {
            const utxo = await generator.mintNftToAddress(toReceiverAddr)
            r.push(utxo)
        }
        return r
    }

    describe('When sending nfts in a single tx', () => {
        it('should send one nft utxo successfully', async () => {
            await testSendResult(await getNftUtxos(nftGenerator, address, 1))
        })

        it('should send multiple nft utxos successfully', async () => {
            await testSendResult(await getNftUtxos(nftGenerator, address, 2))
        })
    })

    async function testSendResult(cat721Utxos: UTXO[]) {
        const { guardPsbt, sendPsbt } = await singleSendNft(
            testSigner,
            testProvider,
            nftGenerator.deployInfo.minterScriptHash,
            cat721Utxos,
            cat721Utxos.map(() => toTokenOwnerAddress(address)),
            await testProvider.getFeeRate()
        )
        verifyTx(guardPsbt, expect)
        verifyTx(sendPsbt, expect)

        for (let index = 0; index < cat721Utxos.length; index++) {
            const nextUtxo = sendPsbt.getUtxo(index)
            expect(cat721Utxos[index].script).to.eq(nextUtxo.script)
            expect(cat721Utxos[index].data).to.eq(nextUtxo.data)
        }
    }
})