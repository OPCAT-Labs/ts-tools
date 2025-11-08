import { ExtPsbt, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { CAT721NftInfo } from "../../src/lib/metadata"
import { ClosedMinterCAT721Meta } from "../../src/contracts/cat721/types"
import { deployClosedMinterCollection } from "../../src/features/cat721/deploy/cat721ClosedMinter"
import { testSigner } from "./testSigner"
import { testProvider } from "./testProvider"
import { toTokenOwnerAddress } from "../../src/utils"
import { ByteString } from "@opcat-labs/scrypt-ts-opcat"
import { mintClosedMinterNft } from "../../src/features/cat721/mint/cat721ClosedMinter"
import { verifyTx } from "../utils"
import { expect } from "chai"
import { singleSendNft } from "../../src/features/cat721/send/singleSend"
import { CAT721ClosedMinterPeripheral, CAT721GuardPeripheral, ContractPeripheral } from "../../src/utils/contractPeripheral"
import { CAT20ClosedMinter, CAT721ClosedMinter, CAT721ClosedMinterMetadata, ConstantsLib } from "../../src/contracts"



export class TestCAT721Generator {
    deployInfo: CAT721NftInfo<ClosedMinterCAT721Meta> & {
        genesisPsbt: ExtPsbt
        deployPsbt: ExtPsbt
    }
    minterPsbt: ExtPsbt


    get minterScriptHash() {
        return this.deployInfo.minterScriptHash
      }
      get guardScriptHashes() {
        return CAT721GuardPeripheral.getGuardScriptHashes()
      }
    constructor(
        deployInfo: CAT721NftInfo<ClosedMinterCAT721Meta> & {
            genesisPsbt: ExtPsbt
            deployPsbt: ExtPsbt
        }
    ) {
        this.deployInfo = deployInfo
        this.minterPsbt = deployInfo.deployPsbt
    }

    static async init(info: ClosedMinterCAT721Meta) {
        const deployInfo = await deployClosedMinterCollection(
            testSigner,
            testProvider,
            info,
            await testProvider.getFeeRate()
        )
        return new TestCAT721Generator(deployInfo)
    }

    private getCat721MinterUtxo() {
        return this.minterPsbt.getUtxo(0)
    }

    async mintThenTransfer(addr: ByteString) {
        const signerAddr = await testSigner.getAddress()
        const signerOwnerAddr = toTokenOwnerAddress(signerAddr)
        const state = CAT721ClosedMinter.deserializeState(this.getCat721MinterUtxo().data)
        const feeUtxos = await testProvider.getUtxos(signerAddr)
        const mintInfo = await mintClosedMinterNft(
            testSigner,
            testSigner,
            testProvider,
            this.getCat721MinterUtxo(),
            {
                contentType: 'image/gif',
                // contentBody: Buffer.from('mint collection ' + this.deployInfo.collectionId + ' nft ' + state.nextLocalId.toString()).toString('hex'),
                contentBody: '47494638396120002000f41300000000442219cc1e00ef3000a35030f76400ff9800fcbd0bfae3177824bfba40c3fa5ac87a83ef17cefa89d78782e0be8695e1bacfdfdcddddffffff00000000000000000000000000000000000000000000000000000000000000000000000021f904000000000021ff0b496d6167654d616769636b0d67616d6d613d302e3435343535002c00000000200020000005ad20238e64699e68aaae6cebbe702ccf746dbb40aee7761efcc01f4f06081a8100d86ec91cb20002a8604aad56934fe9b4d95c419793b0783cc69ebe63c984cb4ca1c56ac0a06038201c0dc84291709abe606c4b6e51514864886166675f41823a5946000494043a95964f47939398958b6e9b040f4b9f9a92940f0f9e99a78ea9aca02a45429da39eb25e3c82359c62beb9389611116b961311c15e9fc49ccd33b600cdc311ad4accc9d4d62721003b',
                nftmetadata: {
                    image: 'https://example.com/' + `${this.deployInfo.collectionId}_${state.nextLocalId}.gif`,
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
        this.minterPsbt = mintInfo.mintPsbt
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
    async mintNftToScriptHash(scriptHash: ByteString) {
        return this.mintThenTransfer(scriptHash)
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
    symbol: string,
    mintCount: number,
    toAddress: string,
): Promise<TestCat721> {
    const metadata: ClosedMinterCAT721Meta = {
        name: `cat721_${symbol}`,
        symbol: `cat721_${symbol}`,
        description: `cat721_${symbol}`,
        max: 2100n,
        icon: '',
        minterMd5: '',
        issuerAddress: toTokenOwnerAddress(toAddress),
    }
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