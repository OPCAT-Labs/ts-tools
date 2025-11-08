import fs from 'fs'
import {dirname, join, resolve, sep} from 'path'

const templateVariables = [
    {
        TIM: 6,
        TOM: 6,
        GTT: 2,
    },
    {
        TIM: 6,
        TOM: 6,
        GTT: 4,
    },
    {
        TIM: 12,
        TOM: 12,
        GTT: 2,
    },
    {
        TIM: 12,
        TOM: 12,
        GTT: 4,
    }
]

function generateGuardTemplateContent(
    sourceFilePath: string,
    TIM: number, 
    TOM: number, 
    GTT: number
) {
    let content = fs.readFileSync(sourceFilePath, 'utf8')

    const fileName = sourceFilePath.split(sep).pop()!
    const dirName_ = dirname(sourceFilePath)
    const targetFileName = fileName.replaceAll('TIM', TIM.toString()).replaceAll('TOM', TOM.toString()).replaceAll('GTT', GTT.toString()).replaceAll('.template', '.ts')
    const targetFilePath = join(dirName_, targetFileName)

    console.log("generate: ", targetFilePath)

    content = content.replaceAll('TIM', `${TIM}`)
    content = content.replaceAll('TOM', `${TOM}`)
    content = content.replaceAll('GTT', `${GTT}`)

    fs.writeFileSync(targetFilePath, content, 'utf8')
    console.log(`Generated guard template: ${targetFilePath}`)
}

async function main() {
    const sourceFilePathCat20 = resolve(__dirname, '../src/contracts/cat20/cat20Guard_TIM_TOM_GTT.template')
    const sourceFilePathCat721 = resolve(__dirname, '../src/contracts/cat721/cat721Guard_TIM_TOM_GTT.template')

    for (const vars of templateVariables) {

        generateGuardTemplateContent(
            sourceFilePathCat20,
            vars.TIM,
            vars.TOM,
            vars.GTT
        )
        generateGuardTemplateContent(
            sourceFilePathCat721,
            vars.TIM,
            vars.TOM,
            vars.GTT
        )
    }
}

main()