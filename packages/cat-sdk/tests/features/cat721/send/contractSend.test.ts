import { ClosedMinterCAT721Meta, ConstantsLib } from "../../../../src/contracts"
import { TestCAT721Generator } from "../../../utils/testCAT721Generator"
import { testSigner } from "../../../utils/testSigner"
import { loadAllArtifacts } from "../utils"
import { toTokenOwnerAddress } from "../../../../src/utils"
import { ByteString, sha256, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { testProvider } from "../../../utils/testProvider"
import { verifyTx } from "../../../utils"
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { contractSendNft } from "../../../utils/testCAT721/features/contractSend";
use(chaiAsPromised)

describe('Test the feature `send` for `CAT721`', () => {
    let nftGenerator: TestCAT721Generator
    let metadata: ClosedMinterCAT721Meta
    let contractHash: ByteString

    before(async () => {
        loadAllArtifacts()
        const address = await testSigner.getAddress()
        contractHash = sha256(toTokenOwnerAddress(address))
        metadata = {
            tag: ConstantsLib.OPCAT_CAT721_METADATA_TAG,
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
            const utxo = await generator.mintNftToScriptHash(toReceiverAddr)
            r.push(utxo)
        }
        return r
    }

    describe('When sending nfts in a single tx', () => {
        it('should contract send one nft utxo successfully', async () => {
            await testSendResult(await getNftUtxos(nftGenerator, contractHash, 1))
        })

        it('should contract send multiple nft utxos successfully', async () => {
            await testSendResult(await getNftUtxos(nftGenerator, contractHash, 2))
        })
    })

    async function testSendResult(cat721Utxos: UTXO[]) {
        const { guardPsbt, sendPsbt } = await contractSendNft(
            testSigner,
            testProvider,
            nftGenerator.deployInfo.minterScriptHash,
            cat721Utxos,
            cat721Utxos.map(() => contractHash),
            await testProvider.getFeeRate()
        )

        // check guard tx
        expect(guardPsbt.isFinalized).not.to.be.undefined
        verifyTx(guardPsbt, expect)

        // check send tx
        expect(sendPsbt.isFinalized).not.to.be.undefined
        verifyTx(sendPsbt, expect)

        // verify nft to receiver
        for (let index = 0; index < cat721Utxos.length; index++) {
            const nextUtxo = sendPsbt.getUtxo(index)
            expect(cat721Utxos[index].script).to.eq(nextUtxo.script)
            expect(cat721Utxos[index].data).to.eq(nextUtxo.data)
        }
    }

})