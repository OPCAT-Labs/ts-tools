import { DefaultSigner } from '@opcat-labs/scrypt-ts'
import { myPrivateKey } from './privateKey'

export const testSigner = new DefaultSigner(
  myPrivateKey,
)
