// The things that are being exported here will be able
// to be imported in another package.
import { Examples } from './contracts/examples.js'
// run npm run compile to generate artifacts
import artifact from '../artifacts/contracts/examples.json'
;(() => {
    Examples.loadArtifact(artifact)
})()

export { Examples }
