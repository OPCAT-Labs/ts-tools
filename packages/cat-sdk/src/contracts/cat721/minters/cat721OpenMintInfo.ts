import { ByteString, StateLib } from "@opcat-labs/scrypt-ts-opcat"


export type CAT721OpenMintInfoState = {
    localId: bigint
    contentDataHash: ByteString
}

export class CAT721OpenMintInfo extends StateLib<CAT721OpenMintInfoState> {}