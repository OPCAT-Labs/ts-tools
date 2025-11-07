import { ConstantsLib } from "../src/contracts";
import { TestCAT20Generator } from "./utils/testCAT20Generator";
import { formatMetadata } from "../src/lib/metadata";
import { testSigner } from './utils/testSigner'
import { toTokenOwnerAddress } from "../src/utils";
import { loadAllArtifacts } from './features/cat20/utils'


async function deploy(
    metadata: {
        name: string,
        symbol: string,
        decimals: number,
    },
    mintAmount: bigint,
    toAddress?: string,
) {
    loadAllArtifacts()
    const defaultToAddress = await testSigner.getAddress()
    const toAddr = toTokenOwnerAddress(toAddress || defaultToAddress)
    const defaultMetadata = {
        tag: ConstantsLib.OPCAT_METADATA_TAG,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: BigInt(metadata.decimals),
        minterMd5: '',
    }
    const generator = await TestCAT20Generator.init(formatMetadata(defaultMetadata))
    await generator.mintTokenToAddr(toAddr, mintAmount)
}

deploy(
    {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
    },
    BigInt(1e8) * BigInt(6),
    'moP2wuUKQ5aqXswdeGX4VoRjbbyd6bc123'
)

// command line usage:
// NETWORK=opcat-testnet npx tsx ./tests/deployCAT20Script.ts