import { method, prop } from "../decorators.js"
import { assert } from "../fns/assert.js"
import { Addr, PubKey, Sig } from "../types/primitives.js"
import { SmartContract } from "../smartContract.js"
import { pubKey2Addr } from "../fns/pubKey2Addr.js"

/**
 * A Pay-to-Public-Key-Hash (P2PKH) smart contract that allows spending 
 * by providing a signature matching the specified public key hash.
 * 
 * @property addr - The address derived from the public key hash that can unlock this contract
 * @method unlock - Verifies the provided signature matches the contract's public key hash
 * @param sig - The signature to verify
 * @param pubkey - The public key corresponding to the address
 * @throws If public key hash doesn't match or signature verification fails
 */
export class P2PKH extends SmartContract {
    @prop()
    readonly addr: Addr

    constructor(addr: Addr) {
        super(...arguments)
        this.addr = addr
    }

    @method()
    public unlock(sig: Sig, pubkey: PubKey) {
        assert(
            pubKey2Addr(pubkey) == this.addr,
            'public key hashes are not equal'
        )
        assert(this.checkSig(sig, pubkey), 'signature check failed')
    }
}

const desc = {
    version: 9,
    compilerVersion: '1.19.0+commit.72eaeba',
    contract: 'P2PKH',
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
                {
                    name: 'pubkey',
                    type: 'PubKey',
                },
            ],
        },
        {
            type: 'constructor',
            params: [
                {
                    name: 'addr',
                    type: 'Ripemd160',
                },
            ],
        },
    ],
    stateProps: [],
    buildType: 'release',
    file: '',
    hex: '76a9<addr>88ac',
    sourceMapFile: '',
}

P2PKH.loadArtifact(desc)
