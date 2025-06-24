import { method, prop } from "../decorators.js"
import { assert } from "../fns/assert.js"
import { PubKey, Sig } from "../types/primitives.js"
import { SmartContract } from "../smartContract.js"

export class P2PK extends SmartContract {
    @prop()
    readonly pubKey: PubKey

    constructor(pubKey: PubKey) {
        super(...arguments)
        this.pubKey = pubKey
    }

    @method()
    public unlock(sig: Sig) {
        assert(this.checkSig(sig, this.pubKey), 'signature check failed')
    }
}

const desc = {
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'P2PK',
    md5: '0c046dfb1f1a91cf72b9a852537bdfe1',
    structs: [],
    library: [],
    alias: [],
    abi: [
        {
            type: 'function',
            name: 'unlock',
            index: 0,
            params: [
                {
                    name: 'sig',
                    type: 'Sig',
                },
            ],
        },
        {
            type: 'constructor',
            params: [
                {
                    name: 'pubKey',
                    type: 'PubKey',
                },
            ],
        },
    ],
    stateProps: [],
    buildType: 'release',
    file: '',
    hex: '<pubKey>ac',
    sourceMapFile: '',
}

P2PK.loadArtifact(desc)
