// The things that are being exported here will be able
// to be imported in another package.
import { PROJECT_NAME } from './contracts/PROJECT_FILENAME.js'

import { TestPROJECT_NAME } from './contracts/testPROJECT_FILENAME.js'
// run npm run compile to generate artifacts
import artifact from '../artifacts/contracts/testPROJECT_FILENAME.json'
;(() => {
    TestPROJECT_NAME.loadArtifact(artifact)
})()

export { PROJECT_NAME, TestPROJECT_NAME }
