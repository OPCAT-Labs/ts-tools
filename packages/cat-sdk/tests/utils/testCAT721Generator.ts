import { ExtPsbt, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { CAT721NftInfo } from "../../src/lib/metadata"
import { ClosedMinterCAT721Meta } from "../../src/contracts/cat721/types"
import { deploy } from "./testCAT721/features/deploy"
import { testSigner } from "./testSigner"
import { testProvider } from "./testProvider"
import { toTokenOwnerAddress } from "../../src/utils"
import { ByteString } from "@opcat-labs/scrypt-ts-opcat"
import { mintNft } from "./testCAT721/features/mint"
import { verifyTx } from "../utils"
import { expect } from "chai"
import { singleSendNft } from "../../src/features/cat721/send/singleSend"
import { CAT721ClosedMinterPeripheral, CAT721GuardPeripheral } from "../../src/utils/contractPeripheral"
import { CAT20ClosedMinter, CAT721ClosedMinter, CAT721ClosedMinterMetadata } from "../../src/contracts"



export class TestCAT721Generator {
    deployInfo: CAT721NftInfo<ClosedMinterCAT721Meta> & {
        genesisPsbt: ExtPsbt
        deployPsbt: ExtPsbt
    }
    minterTx: ExtPsbt

    constructor(
        deployInfo: CAT721NftInfo<ClosedMinterCAT721Meta> & {
            genesisPsbt: ExtPsbt
            deployPsbt: ExtPsbt
        }
    ) {
        this.deployInfo = deployInfo
        this.minterTx = deployInfo.deployPsbt
    }

    static async init(info: ClosedMinterCAT721Meta) {
        const deployInfo = await deploy(
            testSigner,
            testProvider,
            info,
            await testProvider.getFeeRate()
        )
        return new TestCAT721Generator(deployInfo)
    }

    private getCat721MinterUtxo() {
        return this.minterTx.getUtxo(0)
    }

    async mintThenTransfer(addr: ByteString) {
        const signerAddr = await testSigner.getAddress()
        const signerOwnerAddr = toTokenOwnerAddress(signerAddr)
        const state = CAT721ClosedMinter.deserializeState(this.getCat721MinterUtxo().data)
        const feeUtxos = await testProvider.getUtxos(signerAddr)
        const mintInfo = await mintNft(
            testSigner,
            testSigner,
            testProvider,
            this.getCat721MinterUtxo(),
            {
                contentType: 'image/png',
                contentBody: 'mint collection ' + this.deployInfo.collectionId + ' nft ' + state.nextLocalId.toString(),
                nftmetadata: {
                    image: 'https://example.com/' + `${this.deployInfo.collectionId}_${state.nextLocalId}.png`,
                    localId: state.nextLocalId,
                },
            },
            this.deployInfo.collectionId,
            this.deployInfo.metadata,
            signerOwnerAddr,
            signerAddr,
            feeUtxos,
            await testProvider.getFeeRate()
        )
        verifyTx(mintInfo.mintPsbt, expect)
        this.minterTx = mintInfo.mintPsbt
        const transferInfo = await singleSendNft(
            testSigner,
            testProvider,
            this.deployInfo.minterScriptHash,
            // the second output is the nft
            [mintInfo.mintPsbt.getUtxo(1)],
            [addr],
            await testProvider.getFeeRate()
        )
        return transferInfo.newNftUtxos[0]
    }
    async mintNftToAddress(addr: ByteString) {
        return this.mintThenTransfer(toTokenOwnerAddress(addr))
    }
}

export type TestCat721 = {
    generator: TestCAT721Generator
    utxos: UTXO[]
    utxoTraces: Array<{
        prevTxHex: string
        prevTxInput: number
        prevPrevTxHex: string
    }>
}

export async function createCat721(
    mintCount: number,
    toAddress: string,
    metadata: ClosedMinterCAT721Meta
): Promise<TestCat721> {
    const cat721Generator = await TestCAT721Generator.init(metadata)
    const cat721: TestCat721 = {
        generator: cat721Generator,
        utxos: [],
        utxoTraces: [],
    }
    for (let i = 0; i < mintCount; i++) {
        const utxo = await cat721Generator.mintNftToAddress(toTokenOwnerAddress(toAddress))
        cat721.utxos.push(utxo)
        cat721.utxoTraces.push(
            ...(await CAT721GuardPeripheral.getBackTraceInfo(
                cat721Generator.deployInfo.minterScriptHash,
                [utxo],
                testProvider
            ))
        )   
    }
    return cat721
}