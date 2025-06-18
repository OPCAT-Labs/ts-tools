// The things that are being exported here will be able
// to be imported in another package.
import { PROJECT_NAME } from './contracts/PROJECT_FILENAME.js'
// run npm run compile to generate artifacts
import artifact from '../artifacts/contracts/PROJECT_FILENAME.json'
;(() => {
    PROJECT_NAME.loadArtifact(artifact)
})()

export { PROJECT_NAME }
