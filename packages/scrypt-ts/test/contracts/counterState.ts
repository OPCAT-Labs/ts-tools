import { Int32, StructObject } from '@opcat-labs/scrypt-ts';

export interface CounterState extends StructObject {
  count: Int32;
}
