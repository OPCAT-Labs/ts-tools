import fs from 'fs'
import {dirname, join, resolve, sep} from 'path'

/**
 * Generate guard contract templates with different configurations.
 *
 * Template Parameters:
 * - TI_COUNT: Transaction Inputs count - maximum number of inputs the guard can handle
 * - TO_COUNT: Transaction Outputs count - maximum number of outputs the guard can handle
 * - GTT_COUNT: Guard Type Tag count - maximum number of different token types or NFT types
 *              that can be transferred in a single transaction
 *
 * Configuration Rationale:
 * We balance transaction size vs functionality by providing multiple template variants:
 *
 * - 6_6_2: Basic transfers with minimal transaction size
 *   Optimized for simple token transfers, keeping transactions as small as possible
 *   to reduce fees and blockchain footprint. Supports up to 2 different token/NFT types.
 *
 * - 6_6_4: Basic transfers with multi-token support
 *   Same input/output limits as 6_6_2 but supports up to 4 different token/NFT types
 *   in a single transaction, enabling more complex token swaps while maintaining
 *   relatively small transaction size.
 *
 * - 12_12_2: Extended I/O capacity for complex operations
 *   Supports more inputs and outputs to handle batch operations and multi-party
 *   transactions, with support for up to 2 different token/NFT types.
 *
 * - 12_12_4: Maximum flexibility for complex contract interactions
 *   Provides the highest capacity for I/O and supports up to 4 different token/NFT types,
 *   enabling complex multi-contract scenarios with multiple token types and contract
 *   interactions in a single transaction.
 */
const templateVariables = [
    {
        TI_COUNT: 6,
        TO_COUNT: 6,
        GTT_COUNT: 2,
    },
    {
        TI_COUNT: 6,
        TO_COUNT: 6,
        GTT_COUNT: 4,
    },
    {
        TI_COUNT: 12,
        TO_COUNT: 12,
        GTT_COUNT: 2,
    },
    {
        TI_COUNT: 12,
        TO_COUNT: 12,
        GTT_COUNT: 4,
    }
]

function generateGuardTemplateContent(
    sourceFilePath: string,
    TI_COUNT: number,
    TO_COUNT: number,
    GTT_COUNT: number
) {
    let content = fs.readFileSync(sourceFilePath, 'utf8')

    const fileName = sourceFilePath.split(sep).pop()!
    const dirName_ = dirname(sourceFilePath)
    const targetFileName = fileName.replaceAll('TI_COUNT', TI_COUNT.toString()).replaceAll('TO_COUNT', TO_COUNT.toString()).replaceAll('GTT_COUNT', GTT_COUNT.toString()).replaceAll('.ts.template', '.ts')
    const targetFilePath = join(dirName_, targetFileName)

    console.log("generate: ", targetFilePath)

    content = content.replaceAll('$TI_COUNT$', `${TI_COUNT}`)
    content = content.replaceAll('$TO_COUNT$', `${TO_COUNT}`)
    content = content.replaceAll('$GTT_COUNT$', `${GTT_COUNT}`)

    fs.writeFileSync(targetFilePath, content, 'utf8')
    console.log(`Generated guard template: ${targetFilePath}`)
}

/**
 * Main function to generate all guard contract variants
 * Generates 4 variants each for CAT20 and CAT721:
 * - 6x6x2: 6 inputs, 6 outputs, 2 token/collection types
 * - 6x6x4: 6 inputs, 6 outputs, 4 token/collection types
 * - 12x12x2: 12 inputs, 12 outputs, 2 token/collection types
 * - 12x12x4: 12 inputs, 12 outputs, 4 token/collection types
 */
async function main() {
    const sourceFilePathCat20 = resolve(__dirname, '../src/contracts/cat20/cat20Guard_TI_COUNT_TO_COUNT_GTT_COUNT.ts.template')
    const sourceFilePathCat721 = resolve(__dirname, '../src/contracts/cat721/cat721Guard_TI_COUNT_TO_COUNT_GTT_COUNT.ts.template')

    for (const vars of templateVariables) {

        generateGuardTemplateContent(
            sourceFilePathCat20,
            vars.TI_COUNT,
            vars.TO_COUNT,
            vars.GTT_COUNT
        )
        generateGuardTemplateContent(
            sourceFilePathCat721,
            vars.TI_COUNT,
            vars.TO_COUNT,
            vars.GTT_COUNT
        )
    }
}

main()