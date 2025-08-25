import { join } from 'path'
import { readFileSync } from 'fs'
import { ChainProvider, UtxoProvider, DummyProvider, ExtPsbt, bvmVerify } from '@opcat-labs/scrypt-ts'

export function readArtifact(artifactFileName: string) {
  const filePath = join(process.cwd(), artifactFileName)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

export function isOnchainTest(provider: UtxoProvider & ChainProvider) {
  const isLocalTest = provider instanceof DummyProvider
  return !isLocalTest
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyTx(tx: ExtPsbt, expect: any) {
  // const verifyRes = tx.verify()
  const inputCount = tx.txInputs.length;
  for (let i = 0; i < inputCount; i++) {
    // console.log(i, bvmVerify(tx, i))
    expect(bvmVerify(tx, i)).to.eq(true);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  // expect(verifyRes === true, verifyRes).to.be.true
}
