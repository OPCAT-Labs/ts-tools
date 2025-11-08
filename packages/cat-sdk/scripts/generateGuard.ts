import fs from 'fs'
import {dirname, join, resolve, sep} from 'path'

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
    const targetFileName = fileName.replaceAll('TI_COUNT', TI_COUNT.toString()).replaceAll('TO_COUNT', TO_COUNT.toString()).replaceAll('GTT_COUNT', GTT_COUNT.toString()).replaceAll('.template', '.ts')
    const targetFilePath = join(dirName_, targetFileName)

    console.log("generate: ", targetFilePath)

    content = content.replaceAll('$TI_COUNT$', `${TI_COUNT}`)
    content = content.replaceAll('$TO_COUNT$', `${TO_COUNT}`)
    content = content.replaceAll('$GTT_COUNT$', `${GTT_COUNT}`)

    fs.writeFileSync(targetFilePath, content, 'utf8')
    console.log(`Generated guard template: ${targetFilePath}`)
}

async function main() {
    const sourceFilePathCat20 = resolve(__dirname, '../src/contracts/cat20/cat20Guard_TI_COUNT_TO_COUNT_GTT_COUNT.template')
    const sourceFilePathCat721 = resolve(__dirname, '../src/contracts/cat721/cat721Guard_TI_COUNT_TO_COUNT_GTT_COUNT.template')

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