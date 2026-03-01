# CAT Protocol Security Test Suite

Red Team Test Engineer security tests for the CAT20 (fungible token) and CAT721 (NFT) standards.

## Table of Contents

- [CAT20 Tests](#cat20-tests)
- [CAT721 Tests](#cat721-tests)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Boundary Values Reference](#boundary-values-reference)

---

## CAT20 Tests

### 1. Negative Tests (Attack Simulations)

Located in `tests/invalid/`:

| Test File | Attack Category | Description |
|-----------|----------------|-------------|
| `cat20SupplyInflation.test.ts` | Supply Inflation | Attempts to create tokens out of thin air |
| `cat20UnauthorizedSpend.test.ts` | Authorization Bypass | Attempts to spend tokens without proper credentials |
| `cat20ConservationBypass.test.ts` | Conservation Violation | Attempts to violate sum(inputs) = sum(outputs) + burn |

### 2. Fuzz Harnesses

Located in `tests/fuzz/`:

| Test File | Fuzz Target | Description |
|-----------|-------------|-------------|
| `cat20FuzzStateSerialization.test.ts` | State Encoding | Malformed states, boundary values, field lengths, OP_CAT orders |
| `cat20FuzzTransactionShape.test.ts` | Transaction Structure | Output ordering, extra outputs, input merging, script indexes |
| `cat20FuzzBoundary.test.ts` | Boundary Values | Integer limits, count boundaries, VarInt encoding |

### CAT20 Fuzz Test Coverage

#### 4.1 State Serialization/Deserialization Fuzzing

| # | Task | Test Description |
|---|------|------------------|
| 4.1.1 | Fuzz random token amounts through `stateHash()` | Deterministic hashes, unique hashes for different amounts, extreme values |
| 4.1.2 | Fuzz random field lengths in state serialization | Various serialized lengths, malformed field lengths, guard state lengths |
| 4.1.3 | Fuzz random OP_CAT concatenation orders | Detect reordered concatenation, field swaps, script hash ordering |
| 4.1.4 | Fuzz `serializeState()` / `deserializeState()` roundtrip | Random states, boundary amounts, multiple roundtrips |
| 4.1.5 | Fuzz `ownerAddr` with various lengths | 20-byte P2PKH, 32-byte contracts, 25-byte full scripts, special patterns |

#### 4.2 Transaction Shape Fuzzing

| # | Task | Test Description |
|---|------|------------------|
| 4.2.1 | Fuzz random output ordering | Shuffled output order, state hash ordering, conservation validation |
| 4.2.2 | Fuzz random extra outputs appended | Undeclared outputs rejection, ghost outputs, maximum valid count |
| 4.2.3 | Fuzz random input merging (multi-type tokens) | Multiple inputs to single output, cross-token rejection, split-merge |
| 4.2.4 | Fuzz `tokenScriptIndexes` with random byte patterns | Invalid indexes, negative values, random byte patterns |
| 4.2.5 | Fuzz `tokenScriptHashIndexes` output array | Out-of-range values, valid indexes, mismatched references |
| 4.2.6 | Fuzz `outputCount` with boundary values | Minimum (1), maximum (TX_OUTPUT_COUNT_MAX-1), exceeding limits |

#### 4.3 Boundary Fuzzing

| # | Task | Test Description |
|---|------|------------------|
| 4.3.1 | Max token amount (near integer overflow boundary) | MAX_SAFE_INTEGER, UINT64_MAX, power-of-two boundaries |
| 4.3.2 | Max supply (remainingCount = 0) | Exhausted supply state, 1-to-0 transition |
| 4.3.3 | Zero supply | Zero amount rejection, initial mint, guard state zeros |
| 4.3.4 | One less than cap | TX_INPUT_COUNT_MAX-1, TX_OUTPUT_COUNT_MAX-1, GUARD_TOKEN_TYPE_MAX-1 |
| 4.3.5 | One more than cap | Exceed input count, exceed token types, invalid script index |
| 4.3.6 | inputCount = 0, 1, inputMax | Minimum valid (1), maximum (TX_INPUT_COUNT_MAX_6-2) |
| 4.3.7 | outputCount = 0, 1, outputMax | Minimum valid (1), maximum (TX_OUTPUT_COUNT_MAX_6-1), pure burn |
| 4.3.8 | tokenTypes = 0, 1, 2, 4 | Single type, multiple types, uniqueness enforcement |
| 4.3.9 | VarInt boundaries | 0xfc (252), 0xfd (253), 0xffff (65535), 0x10000 (65536), encoding transitions |

### CAT20 Attack Vectors

#### Supply Inflation (2.3.1)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Mint more than limit | `remainingCount` enforcement |
| 2 | Inflate `remainingCount` | Sum verification |
| 3 | Mint after exhaustion | Zero count check |
| 4 | Exceed premine | Amount equality check |
| 5 | Forge guard state | State hash verification |
| 6 | Duplicate token script | Uniqueness assertion |
| 7 | State hash mismatch | Hash binding |
| 8 | Integer overflow | SafeMath |
| 9 | Negative amounts | Positivity checks |

#### Unauthorized Spend (2.3.2)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Wrong signature | ECDSA verification |
| 2 | Wrong pubkey | Pubkey-to-address hash check |
| 3 | Signature replay | Sighash uniqueness |
| 4 | No guard input | Guard presence check |
| 5 | Fake guard | Script hash whitelist |
| 6 | Wrong guard index | Index bounds check |
| 7 | Fake contract spend | Owner script verification |
| 8 | Fake admin spend | Admin privilege check |
| 9 | Invalid spendType | Range check [0,2] |
| 10 | Forged backtrace | Hash chain verification |

#### Conservation Bypass (2.3.3)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Output > Input | Sum equality assertion |
| 2 | Fake burn | Burn + output sum check |
| 3 | Split inflation | Per-output accounting |
| 4 | Claim higher input | State hash verification |
| 5 | Double-claim UTXO | Script index validation |
| 6 | Mismatched states | Input state verification |
| 7 | Negative burn | Positivity check |
| 8 | Over-burn | Sum consistency |
| 9 | Cross-token confusion | Per-type accounting |
| 10 | Hidden outputs | Output count binding |

---

## CAT721 Tests

### 1. Negative Tests (Attack Simulations)

Located in `tests/invalid/`:

| Test File | Attack Category | Description |
|-----------|----------------|-------------|
| `cat721SupplyInflation.test.ts` | Supply Inflation | Attempts to create NFTs out of thin air |
| `cat721UnauthorizedSpend.test.ts` | Authorization Bypass | Attempts to transfer NFTs without proper credentials |
| `cat721ConservationBypass.test.ts` | Conservation Violation | Attempts to violate count(inputs) = count(outputs) + count(burns) |

### 2. Fuzz Harnesses

Located in `tests/fuzz/`:

| Test File | Fuzz Target | Description |
|-----------|-------------|-------------|
| `cat721FuzzStateSerialization.test.ts` | State Encoding | LocalId values, ownerAddr lengths, guard state, burn masks |
| `cat721FuzzTransactionShape.test.ts` | Transaction Structure | Burn patterns, localId ordering, inflation/loss rejection |
| `cat721FuzzBoundary.test.ts` | Boundary Values | LocalId limits, count boundaries, burn mask patterns |

### CAT721 Fuzz Test Coverage

#### 4.1 State Serialization/Deserialization Fuzzing (NFT)

| # | Task | Test Description |
|---|------|------------------|
| 4.1.1 | Fuzz random localId values through `stateHash()` | Deterministic hashes, unique hashes, boundary values |
| 4.1.2 | Fuzz random ownerAddr lengths | 20-byte P2PKH, 32-byte contracts, special patterns |
| 4.1.3 | Fuzz guard state field ordering | Script hash ordering, burn mask ordering |
| 4.1.4 | Fuzz `serializeState()` / `deserializeState()` roundtrip | Random NFT states, multiple roundtrips |
| 4.1.5 | Fuzz burn mask patterns | All burned, none burned, alternating, random |

#### 4.2 Transaction Shape Fuzzing (NFT)

| # | Task | Test Description |
|---|------|------------------|
| 4.2.1 | Fuzz valid burn patterns | Single burn, multiple burns, all burns |
| 4.2.2 | Fuzz localId ordering in outputs | Correct ordering, shuffled (rejected), skipped (rejected) |
| 4.2.3 | Fuzz inflation attempts | Output > input rejection |
| 4.2.4 | Fuzz loss attempts | Output < input without proper burn rejection |
| 4.2.5 | Fuzz `nftScriptIndexes` with random patterns | Invalid indexes, out-of-range values |
| 4.2.6 | Fuzz multi-collection transactions | Mixed collections, cross-collection rejection |

#### 4.3 Boundary Fuzzing (NFT)

| # | Task | Test Description |
|---|------|------------------|
| 4.3.1 | Max localId (near integer boundary) | MAX_SAFE_INTEGER, UINT64_MAX, power-of-two |
| 4.3.2 | Max collection size | Large NFT counts, sequential localIds |
| 4.3.3 | Zero/empty collection states | Empty guard, first NFT (localId=0) |
| 4.3.4 | One less than cap | TX_INPUT_COUNT_MAX-1, TX_OUTPUT_COUNT_MAX-1 |
| 4.3.5 | One more than cap | Exceed limits, invalid script index |
| 4.3.6 | inputCount = 0, 1, inputMax | Single NFT, maximum NFT inputs |
| 4.3.7 | outputCount = 0, 1, outputMax | Pure burn, maximum NFT outputs |
| 4.3.8 | Burn mask boundaries | All 1s, all 0s, alternating, random patterns |
| 4.3.9 | LocalId sequence boundaries | Consecutive, sparse, VarInt encoding |

### CAT721 Attack Vectors

#### Supply Inflation (NFT)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Create NFT from nothing | Input count check |
| 2 | Duplicate localId in outputs | LocalId uniqueness |
| 3 | Mint beyond collection max | remainingCount check |
| 4 | Forge guard state | State hash verification |
| 5 | Inflate NFT count | Count equality assertion |
| 6 | Clone existing NFT | Script hash binding |
| 7 | State hash manipulation | Hash verification |

#### Unauthorized Spend (NFT)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Wrong signature | ECDSA verification |
| 2 | Wrong pubkey | Pubkey-to-address hash |
| 3 | Signature replay | Sighash uniqueness |
| 4 | No guard input | Guard presence check |
| 5 | Fake guard | Script hash whitelist |
| 6 | Wrong guard index | Index bounds check |
| 7 | Transfer without ownership | Owner verification |

#### Conservation Bypass (NFT)

| # | Attack | Defense |
|---|--------|---------|
| 1 | Output count > Input count | Count equality |
| 2 | Output count < Input count (no burn) | Burn mask verification |
| 3 | Fake burn (output + burn) | Double-count prevention |
| 4 | Wrong localId order | Ordering verification |
| 5 | Skip localId in sequence | Sequence validation |
| 6 | Cross-collection swap | Script hash isolation |
| 7 | Hidden/ghost outputs | Output count binding |
| 8 | Double burn same NFT | Burn mask uniqueness |

---

## Running Tests

### Run All Attack Tests

```bash
cd packages/cat-sdk
npm test -- --grep "Attack\|Fuzz"
```

### Run by Token Standard

```bash
# All CAT20 tests
npm test -- --grep "CAT20"

# All CAT721 tests
npm test -- --grep "CAT721"
```

### Run Specific Categories

```bash
# Supply inflation attacks (both standards)
npm test -- --grep "Supply Inflation"

# Unauthorized spend attacks
npm test -- --grep "Unauthorized Spend"

# Conservation bypass attacks
npm test -- --grep "Conservation Bypass"

# Transaction shape fuzzing
npm test -- --grep "Transaction Shape"

# State serialization fuzzing
npm test -- --grep "State Serialization"

# Boundary testing
npm test -- --grep "Boundary"
```

---

## Test Structure

### Negative Tests

Each negative test follows this pattern:

1. **Setup**: Create valid tokens/NFTs
2. **Attack**: Attempt malicious operation
3. **Assertion**: Verify the attack is REJECTED

```typescript
it('should FAIL: attack description', async () => {
    const cat20 = await createCat20([1000n], address, 'test');

    return expect(
        performAttack(cat20)
    ).to.eventually.be.rejectedWith('expected error message');
});
```

### Fuzz Tests

Fuzz tests use property-based testing with reproducible seeds:

```typescript
class FuzzRng {
    constructor(seed: number) { ... }
    next(): number { ... }
    nextInt(min: number, max: number): number { ... }
    nextBigInt(min: bigint, max: bigint): bigint { ... }
}

it('should accept all valid conservation-preserving shapes', async function() {
    const rng = new FuzzRng(12345); // Reproducible seed
    for (let i = 0; i < ITERATIONS; i++) {
        const shape = generateValidTxShape(rng);
        // Execute and verify success
    }
});
```

---

## Boundary Values Reference

| Constant | Value | Description |
|----------|-------|-------------|
| `UINT8_MAX` | 255 | Max 1-byte unsigned |
| `UINT16_MAX` | 65535 | Max 2-byte unsigned |
| `UINT32_MAX` | ~4.29 billion | Max 4-byte unsigned |
| `UINT64_MAX` | ~18.4 quintillion | Max 8-byte unsigned |
| `MAX_SAFE_INTEGER` | 2^53 - 1 | JavaScript safe integer limit |
| `TX_INPUT_COUNT_MAX_6` | 6 | Max inputs for 6-variant guard |
| `TX_INPUT_COUNT_MAX_12` | 12 | Max inputs for 12-variant guard |
| `TX_OUTPUT_COUNT_MAX_6` | 6 | Max outputs for 6-variant guard |
| `TX_OUTPUT_COUNT_MAX_12` | 12 | Max outputs for 12-variant guard |
| `GUARD_TOKEN_TYPE_MAX` | 4 | Max token types per transaction |
| `NFT_SCRIPT_TYPE_MAX` | 4 | Max NFT collections per transaction |
| `VARINT_1BYTE_MAX` | 252 (0xfc) | Max VarInt single byte |
| `VARINT_2BYTE_MIN` | 253 (0xfd) | Min VarInt 2-byte encoding |
| `VARINT_4BYTE_MIN` | 65536 (0x10000) | Min VarInt 4-byte encoding |

---

## Key Differences: CAT20 vs CAT721

| Aspect | CAT20 (Fungible) | CAT721 (NFT) |
|--------|------------------|--------------|
| State field | `amount: bigint` | `localId: bigint` |
| Conservation | sum(inputs) = sum(outputs) + burn | count(inputs) = count(outputs) + count(burns) |
| Burn tracking | `tokenBurnAmounts[i]` | `nftBurnMasks` (bitmask) |
| Uniqueness | Amounts can match | Each localId is unique |
| Ordering | No ordering requirement | LocalIds must maintain order |
| Script index | `tokenScriptIndexes` | `nftScriptIndexes` |
| Max types | `GUARD_TOKEN_TYPE_MAX` | `NFT_SCRIPT_TYPE_MAX` |

---

## Expected Results

**ALL attack tests should FAIL** (be rejected by the contracts). This confirms:

1. Token/NFT supply cannot be inflated
2. Assets cannot be spent without authorization
3. Conservation law is enforced on-chain
4. State serialization is robust against fuzzing
5. Boundary conditions are properly handled
6. LocalId ordering is enforced (CAT721)
7. Burn masks are correctly validated (CAT721)

If any attack test PASSES, it indicates a potential vulnerability.
