import { DefaultSigner } from '@opcat-labs/scrypt-ts-opcat'
import { myPrivateKey } from './privateKey'

export const testSigner = new DefaultSigner(
  myPrivateKey,
)
