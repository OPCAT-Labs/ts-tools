
import { ByteString, UTXO } from "@opcat-labs/scrypt-ts-opcat";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ClosedMinterCAT721Meta } from "../../../../src/contracts/cat721/types";
import { TestCAT721Generator } from "../../../utils/testCAT721Generator";
import { loadAllArtifacts } from "../utils";
import { testSigner } from "../../../utils/testSigner";
import { toTokenOwnerAddress } from "../../../../src/utils";
import { ConstantsLib } from "../../../../src/contracts";
import { testProvider } from "../../../utils/testProvider";
import { burnNft } from "../../../../src/features/cat721/burn/burn";
import { verifyTx } from "../../../utils";

use(chaiAsPromised)

describe('Test the feature `burn` for `CAT721`', () => {
    let toReceiverAddr: ByteString
    let metadata: ClosedMinterCAT721Meta
    let cat721Generater: TestCAT721Generator

    before(async () => {
        loadAllArtifacts()
        const address = await testSigner.getAddress()
        toReceiverAddr = toTokenOwnerAddress(address)

        metadata = {
            tag: ConstantsLib.OPCAT_CAT721_METADATA_TAG,
            name: 'c',
            symbol: 'C',
            description: 'c',
            max: 2100n,
            icon: '',
            minterMd5: '',
            issuerAddress: toReceiverAddr,
        }
        cat721Generater = await TestCAT721Generator.init(metadata)
    })

    const getTokenUtxos = async function (
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

    describe('When burn tokens in a single tx', () => {
        it('should burn one token utxo successfully', async () => {
            await testBurnResult(await getTokenUtxos(cat721Generater, toReceiverAddr, 1))
        })

        it('should burn multiple token utxos successfully', async () => {
            await testBurnResult(await getTokenUtxos(cat721Generater, toReceiverAddr, 2))
        })
    })

    async function testBurnResult(cat721Utxos: UTXO[]) {
        const { guardPsbt, burnPsbt } = await burnNft(
            testSigner,
            testProvider,
            cat721Generater.deployInfo.minterScriptHash,
            cat721Utxos,
            await testProvider.getFeeRate()
        )

        // check guard tx
        expect(guardPsbt.isFinalized).not.to.be.undefined
        verifyTx(guardPsbt, expect)

        // check send tx
        expect(burnPsbt.isFinalized).not.to.be.undefined
        verifyTx(burnPsbt, expect)
    }
})