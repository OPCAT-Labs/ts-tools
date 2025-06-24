import { method, prop } from '../decorators.js';
import { assert, byteStringToInt, len, slice, toByteString } from '../fns/index.js';
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString } from '../types/primitives.js';
import { StdUtils } from './stdUtils.js';

/**
 * A reader to parse a ByteString buffer 
 * @category Standard Contracts
 */
export class ByteStringReader extends SmartContractLib {

    @prop()
    buf: ByteString;
    @prop()
    pos: bigint;

    constructor(buf: ByteString) {
        super(buf);
        this.buf = buf;
        this.pos = 0n;
    }

    /**
     * Check if all have been read
     * @returns true if all have been read
     */
    @method()
    eof(): boolean {
        return this.pos >= len(this.buf);
    }

    /**
     * read bytes which encoded with bitcoin [value-pushing words]{@link https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script}
     * @returns true if all have been read
     */
    @method()
    readBytes(): ByteString {
        let l: bigint = 0n;
        let buf: ByteString = this.buf;
        let ret: ByteString = toByteString('');
        let header: bigint = byteStringToInt(slice(this.buf, this.pos, this.pos + 1n));
        this.pos++;

        if (header < 0x4cn) {
            l = header;
            ret = slice(buf, this.pos, this.pos + l);
        }
        else if (header == 0x4cn) {
            l = StdUtils.fromLEUnsigned(slice(buf, this.pos, this.pos + 1n));
            this.pos += 1n;
            ret = slice(this.buf, this.pos, this.pos + l);
        }
        else if (header == 0x4dn) {
            l = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 2n));
            this.pos += 2n
            ret = slice(this.buf, this.pos, this.pos + l);
        }
        else if (header == 0x4en) {
            l = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 4n));
            this.pos += 4n;
            ret = slice(this.buf, this.pos, this.pos + l);
        }
        else {
            // shall not reach here
            assert(false);
        }

        this.pos += l;
        return ret;

    }

    /**
     * read a byte as boolean
     * @returns true if the read byte not equal to '00'
     */
    @method()
    readBool(): boolean {
        let buf: ByteString = slice(this.buf, this.pos, this.pos + 1n);
        this.pos++;
        return toByteString('00') != buf;
    }

    /**
     * read bytes as `readBytes` and convert it to a number with `byteString2Int`
     * @returns a number
     */
    @method()
    readVarint(): bigint {
        let ret: bigint = -1n;
        let header: bigint = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 1n));
        this.pos++;
        if (header == 0xfdn) {
            ret = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 2n));
            this.pos += 2n;
        }
        else if (header == 0xfen) {
            ret = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 4n));
            this.pos += 4n;
        }
        else if (header == 0xffn) {
            ret = StdUtils.fromLEUnsigned(slice(this.buf, this.pos, this.pos + 8n));
            this.pos += 8n;
        }
        else {
            ret = header;
        }
        return ret;
    }
}
