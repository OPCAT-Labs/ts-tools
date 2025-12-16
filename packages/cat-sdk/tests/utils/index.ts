import { join } from 'path'
import { readFileSync } from 'fs'
import { ChainProvider, UtxoProvider, DummyProvider, ExtPsbt, bvmVerify } from '@opcat-labs/scrypt-ts-opcat'
import { expect } from 'chai'

export function readArtifact(artifactFileName: string) {
  const filePath = join(process.cwd(), artifactFileName)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

export function isOnchainTest(provider: UtxoProvider & ChainProvider) {
  const isLocalTest = provider instanceof DummyProvider
  return !isLocalTest
}

export function isLocalTest(provider: UtxoProvider & ChainProvider) {
  return provider instanceof DummyProvider
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


export function runWithDryCheck<T>(
  provider: UtxoProvider & ChainProvider,
  feature: T & { dryRun: T },
): T {
  return async function (...args: any[]) {
    const isLocal = isLocalTest(provider);
    const dryRunResult = await (feature.dryRun as any)(...args);
    const actualRunResult = await (feature as any)(...args);

    // If not local test, compare dry run result with actual run result for consistency check
    // Do not do this check for local test to allow more randomness local testing
    if (!isLocal) {
      for (const key in dryRunResult) {
        // only compare primitive values for faster check
        if (
          typeof dryRunResult[key] !== 'object' && 
          typeof dryRunResult[key] !== 'function' &&
          key !== 'timestamp'
        ) {
          expect(dryRunResult[key]).to.deep.equal(actualRunResult[key]);
        }
      }
      console.log('Dry run result matches actual run result.');
    }
    return actualRunResult;
  } as T;
}