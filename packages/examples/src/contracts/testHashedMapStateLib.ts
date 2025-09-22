import { ByteString, HashedMap, Int32, StateLib, UInt64 } from "@opcat-labs/scrypt-ts-opcat"

export type DummyStruct = {
    num: bigint
    str: ByteString
}

export type TestHashedMapMainState = {
    // map1: HashedMap<bigint, ByteString, 2>
    map1: HashedMap<Int32, ByteString, 2>
    map2: HashedMap<ByteString, DummyStruct, 1>
}

export class TestHashedMapStateLib extends StateLib<TestHashedMapMainState> {
}