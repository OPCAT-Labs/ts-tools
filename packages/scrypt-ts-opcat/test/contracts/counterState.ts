import { Int32, StructObject } from '@opcat-labs/scrypt-ts-opcat';

export interface CounterState extends StructObject {
  count: Int32;
}
