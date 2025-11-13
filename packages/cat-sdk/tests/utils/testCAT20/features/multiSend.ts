import { ByteString, ChainProvider, ExtPsbt, Signer, UTXO, UtxoProvider, assert, fill, intToByteString, sha256, toByteString, slice, PubKey, getBackTraceInfo, toHex, markSpent, fromSupportedNetwork } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20GuardStateLib, CAT20StateLib, CAT20, GUARD_TOKEN_TYPE_MAX, CAT20GuardConstState, CAT20State, SPEND_TYPE_USER_SPEND } from "../../../../src/contracts";
import { CAT20GuardPeripheral, ContractPeripheral } from "../../../../src/utils/contractPeripheral";
import { Postage } from "../../../../src/typeConstants";
import { applyFixedArray, filterFeeUtxos } from "../../../../src/utils";
import * as opcat from '@opcat-labs/opcat';
import { Transaction } from '@opcat-labs/opcat';

export type CAT20Reciever = {
    address: ByteString;
    amount: bigint;
}
export type TokenTransferInfo = {
    inputUtxos: UTXO[]
    receivers: CAT20Reciever[]
    minterScriptHash: ByteString
    hasAdmin?: boolean
    adminScriptHash?: ByteString
}
export type MultiTokenTransferInfo = {
    type1: TokenTransferInfo
    type2?: TokenTransferInfo
    type3?: TokenTransferInfo
    type4?: TokenTransferInfo
}
export async function multiSendTokens(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    tokens: MultiTokenTransferInfo,
    maxInputCount: number,
    maxOutputCount: number,
    guardTokenTypeCapacity: number,  // Guard contract's token type capacity (2 or 4)
    feeRate: number,
    options?: {
        addFeeChangeOutput?: boolean;
        guardDustLimit?: bigint;
        addFeeInput?: boolean;
        buildPsbtCallback?: (psbt: ExtPsbt) => void;
    }
): Promise<{
    guardPsbt: ExtPsbt
    sendPsbt: ExtPsbt
    guardTxId: string
    sendTxId: string
}> {
    // no token change, no cat20 admin
    // if inputToken balance > receiver balance, then some token is burned
    // otherwise, all input token is sent to receivers

    // Extract token info from MultiTokenTransferInfo
    const type1TokenUtxos = tokens.type1.inputUtxos;
    const type1TokenReceivers = tokens.type1.receivers;
    const type2TokenUtxos = tokens.type2?.inputUtxos || [];
    const type2TokenReceivers = tokens.type2?.receivers || [];
    const type3TokenUtxos = tokens.type3?.inputUtxos || [];
    const type3TokenReceivers = tokens.type3?.receivers || [];
    const type4TokenUtxos = tokens.type4?.inputUtxos || [];
    const type4TokenReceivers = tokens.type4?.receivers || [];

    // Build arrays for each token type's metadata
    const tokenTypeInfos = [
        tokens.type1,
        tokens.type2,
        tokens.type3,
        tokens.type4
    ];

    // 1. make sure maxInputCount and maxOutputCount are equal and valid: 6 or 12
    assert(maxInputCount === maxOutputCount, `maxInputCount (${maxInputCount}) must equal maxOutputCount (${maxOutputCount})`);
    assert(maxInputCount === 6 || maxInputCount === 12, `maxInputCount must be 6 or 12, got ${maxInputCount}`);

    // 2. validate guard token type capacity
    assert(guardTokenTypeCapacity == 2 || guardTokenTypeCapacity == 4,
           `guardTokenTypeCapacity must be 2 or 4, got ${guardTokenTypeCapacity}`);

    // Calculate actual number of token types being used in this transaction
    const tokenTypeUtxos = [type1TokenUtxos, type2TokenUtxos, type3TokenUtxos, type4TokenUtxos];
    const actualTokenTypes: number[] = [];
    for (let i = 0; i < guardTokenTypeCapacity; i++) {
        if (tokenTypeUtxos[i].length > 0) {
            actualTokenTypes.push(i);
        }
    }
    const actualTokenTypeCount = actualTokenTypes.length;

    // Validate actual token types don't exceed guard capacity
    assert(actualTokenTypeCount > 0, 'At least one token type must be provided');
    assert(actualTokenTypeCount <= guardTokenTypeCapacity,
           `Actual token types (${actualTokenTypeCount}) exceeds guard capacity (${guardTokenTypeCapacity})`);

    // Helper functions to validate arrays
    const mustEmpty = (array: any[], variableName: string) => {
        assert(array.length === 0, `${variableName} must be empty when guardTokenTypeCapacity = ${guardTokenTypeCapacity}`);
    };

    // Validate token arrays based on guard capacity
    switch (guardTokenTypeCapacity) {
        case 2:
            // Type 3, 4 must be empty (both inputs and receivers)
            mustEmpty(type3TokenUtxos, 'type3TokenUtxos');
            mustEmpty(type3TokenReceivers, 'type3TokenReceivers');
            mustEmpty(type4TokenUtxos, 'type4TokenUtxos');
            mustEmpty(type4TokenReceivers, 'type4TokenReceivers');
            break;
        case 4:
            // All 4 types are allowed
            break;
        default:
            // This should never happen due to earlier validation
            assert(false, `Invalid guardTokenTypeCapacity: ${guardTokenTypeCapacity}`);
    }

    // calculate the input counts and output counts
    // inputCount = inputTokenUtxos + (addFeeInput ? 1 : 0) + 1(guardInput)
    // outputCount = outputTokenReceivers + (addFeeChangeOutput ? 1 : 0)
    const addFeeInput = options?.addFeeInput ?? false;
    const addFeeChangeOutput = options?.addFeeChangeOutput ?? false;
    const guardDustLimit = options?.guardDustLimit ?? Postage.GUARD_POSTAGE;

    const totalInputTokenUtxos = type1TokenUtxos.length + type2TokenUtxos.length +
                                  type3TokenUtxos.length + type4TokenUtxos.length;
    const totalOutputTokenReceivers = type1TokenReceivers.length + type2TokenReceivers.length +
                                       type3TokenReceivers.length + type4TokenReceivers.length;

    const inputCount = totalInputTokenUtxos + (addFeeInput ? 1 : 0) + 1; // +1 for guardInput
    const outputCount = totalOutputTokenReceivers + (addFeeChangeOutput ? 1 : 0);

    // input counts must be <= maxInputCount
    assert(inputCount <= maxInputCount, `inputCount (${inputCount}) exceeds maxInputCount (${maxInputCount})`);

    // output counts must be <= maxOutputCount
    assert(outputCount <= maxOutputCount, `outputCount (${outputCount}) exceeds maxOutputCount (${maxOutputCount})`);

    // 3. build guard state
    const guardState = createMultiSendGuardState(
        [type1TokenUtxos, type2TokenUtxos, type3TokenUtxos, type4TokenUtxos],
        [type1TokenReceivers, type2TokenReceivers, type3TokenReceivers, type4TokenReceivers],
        actualTokenTypeCount,
        maxInputCount
    );

    // Select the appropriate guard based on guard capacity parameters
    const { guard } = CAT20GuardPeripheral.selectCAT20Guard(
        maxInputCount,
        maxOutputCount,
        guardTokenTypeCapacity
    );
    guard.state = guardState;

    // Get necessary information
    const pubkey = await signer.getPublicKey();
    const feeChangeAddress = await signer.getAddress();
    let feeUtxos = await provider.getUtxos(feeChangeAddress);
    feeUtxos = filterFeeUtxos(feeUtxos);

    if (feeUtxos.length === 0) {
        throw new Error('Insufficient satoshis input amount');
    }

    const network = await provider.getNetwork();
    const guardScriptHashes = CAT20GuardPeripheral.getGuardVariantScriptHashes();

    // 4. build guard psbt
    const guardPsbt = new ExtPsbt({ network })
        .spendUTXO(feeUtxos[0])
        .addContractOutput(guard, Number(guardDustLimit))
        .change(feeChangeAddress, feeRate)
        .seal();

    // 5. sign and broadcast guard psbt
    const signedGuardPsbt = ExtPsbt.fromHex(await signer.signPsbt(guardPsbt.toHex(), guardPsbt.psbtOptions()));
    guardPsbt.combine(signedGuardPsbt).finalizeAllInputs();

    await provider.broadcast(guardPsbt.extractTransaction().toHex());
    markSpent(provider, guardPsbt.extractTransaction());

    const guardUtxo = guardPsbt.getUtxo(0);
    const feeUtxo = guardPsbt.getChangeUTXO()!;

    // 6. build send psbt
    // Get backtraces for each token type
    const allBacktraces: Array<{
        prevTxHex: string;
        prevTxInput: number;
        prevPrevTxHex: string;
    }> = [];

    for (const typeIndex of actualTokenTypes) {
        const utxos = tokenTypeUtxos[typeIndex];
        const info = tokenTypeInfos[typeIndex];
        if (!info || utxos.length === 0) continue;

        const backtraces = await CAT20GuardPeripheral.getBackTraceInfo(
            info.minterScriptHash,
            utxos,
            provider,
            info.hasAdmin ?? false,
            info.adminScriptHash ?? toByteString('')
        );
        allBacktraces.push(...backtraces);
    }

    // Collect all token UTXOs with their type info
    const allTokenUtxos = [
        ...type1TokenUtxos,
        ...type2TokenUtxos,
        ...type3TokenUtxos,
        ...type4TokenUtxos,
    ];

    // Create token contracts with corresponding type info
    const tokenContracts: CAT20[] = [];
    let utxoIndex = 0;
    for (const typeIndex of actualTokenTypes) {
        const utxos = tokenTypeUtxos[typeIndex];
        const info = tokenTypeInfos[typeIndex];
        if (!info || utxos.length === 0) continue;

        for (let i = 0; i < utxos.length; i++) {
            const contract = new CAT20(
                info.minterScriptHash,
                guardScriptHashes,
                info.hasAdmin ?? false,
                info.adminScriptHash ?? toByteString('')
            ).bindToUtxo({
                ...utxos[i],
                txHashPreimage: toHex(
                    new Transaction(allBacktraces[utxoIndex].prevTxHex).toTxHashPreimage()
                ),
            });
            tokenContracts.push(contract);
            utxoIndex++;
        }
    }

    const sendPsbt = new ExtPsbt({ network });
    const guardInputIndex = tokenContracts.length;

    const inputTokenStates = allTokenUtxos.map((utxo) =>
        CAT20.deserializeState(utxo.data)
    );

    // Add token inputs
    for (let index = 0; index < tokenContracts.length; index++) {
        sendPsbt.addContractInput(tokenContracts[index], (cat20, tx) => {
            const address = opcat.Script.fromHex(inputTokenStates[index].ownerAddr).toAddress(fromSupportedNetwork(network));
            const sig = tx.getSig(index, {
                address: address.toString()
            });
            return cat20.unlock(
                {
                    spendType: SPEND_TYPE_USER_SPEND,
                    userPubKey: PubKey(pubkey),
                    userSig: sig,
                    spendScriptInputIndex: -1n,
                },
                guardState,
                BigInt(guardInputIndex),
                getBackTraceInfo(
                    allBacktraces[index].prevTxHex,
                    allBacktraces[index].prevPrevTxHex,
                    allBacktraces[index].prevTxInput
                )
            );
        });
    }

    // Add token outputs - need to create them with corresponding token type info
    const allTokenReceivers = [
        ...type1TokenReceivers,
        ...type2TokenReceivers,
        ...type3TokenReceivers,
        ...type4TokenReceivers,
    ];

    const outputTokenStates: CAT20State[] = allTokenReceivers.map(receiver => ({
        ownerAddr: receiver.address,
        amount: receiver.amount,
    }));

    // Create output contracts with corresponding type info
    let receiverIndex = 0;
    const tokenTypeReceivers = [type1TokenReceivers, type2TokenReceivers, type3TokenReceivers, type4TokenReceivers];
    for (const typeIndex of actualTokenTypes) {
        const receivers = tokenTypeReceivers[typeIndex];
        const info = tokenTypeInfos[typeIndex];
        if (!info || receivers.length === 0) continue;

        for (let i = 0; i < receivers.length; i++) {
            const cat20 = new CAT20(
                info.minterScriptHash,
                guardScriptHashes,
                info.hasAdmin ?? false,
                info.adminScriptHash ?? toByteString('')
            );
            cat20.state = outputTokenStates[receiverIndex];
            sendPsbt.addContractOutput(cat20, Postage.TOKEN_POSTAGE);
            receiverIndex++;
        }
    }

    // Add guard input
    guard.bindToUtxo(guardUtxo);
    sendPsbt.addContractInput(guard, (contract, tx) => {
        const ownerAddrOrScriptHashes = fill(toByteString(''), maxOutputCount);
        applyFixedArray(
            ownerAddrOrScriptHashes,
            tx.txOutputs.map((output, index) => {
                return index < outputTokenStates.length
                    ? outputTokenStates[index].ownerAddr
                    : ContractPeripheral.scriptHash(toHex(output.script));
            })
        );
        const outputTokenAmts = fill(BigInt(0), maxOutputCount);
        applyFixedArray(
            outputTokenAmts,
            outputTokenStates.map((t) => t.amount)
        );
        const tokenScriptIndexArray = fill(-1n, maxOutputCount);
        // Map each output to its token type index
        let outputIndex = 0;
        for (const typeIndex of actualTokenTypes) {
            const receivers = tokenTypeReceivers[typeIndex];
            for (let i = 0; i < receivers.length; i++) {
                tokenScriptIndexArray[outputIndex] = BigInt(typeIndex);
                outputIndex++;
            }
        }

        const outputSatoshis = fill(0n, maxOutputCount);
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map((output) => output.value)
        );
        const inputCAT20States = fill(
            CAT20StateLib.create(0n, ''),
            maxInputCount
        );
        applyFixedArray(inputCAT20States, inputTokenStates);
        const nextStateHashes = fill(toByteString(''), maxOutputCount);
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map((output) => sha256(toHex(output.data)))
        );

        contract.unlock(
            nextStateHashes as any,
            ownerAddrOrScriptHashes as any,
            outputTokenAmts as any,
            tokenScriptIndexArray as any,
            outputSatoshis as any,
            inputCAT20States as any,
            BigInt(tx.txOutputs.length)
        );
    });

    // Add fee input
    if (addFeeInput) {
        sendPsbt.spendUTXO(feeUtxo);
    }

    // Addtional psbt build callback
    if (options?.buildPsbtCallback) {
        options.buildPsbtCallback(sendPsbt);
    }

    // Add change output if needed
    if (addFeeChangeOutput) {
        sendPsbt.change(feeChangeAddress, feeRate);
    }

    sendPsbt.seal();

    // 7. sign and broadcast send psbt
    const signedSendPsbt = ExtPsbt.fromHex(await signer.signPsbt(sendPsbt.toHex(), sendPsbt.psbtOptions()));
    sendPsbt.combine(signedSendPsbt).finalizeAllInputs();

    await provider.broadcast(sendPsbt.extractTransaction().toHex());
    markSpent(provider, sendPsbt.extractTransaction());

    return {
        guardPsbt,
        sendPsbt,
        guardTxId: guardPsbt.extractTransaction().id,
        sendTxId: sendPsbt.extractTransaction().id,
    };
}




/**
 * Create guard state for multi-token send
 * @param tokenTypeUtxos Array of UTXOs for each token type [type1, type2, type3, type4]
 * @param tokenTypeReceivers Array of receivers for each token type [type1, type2, type3, type4]
 * @param actualTokenTypeCount Actual number of token types being used in this transaction
 * @param maxInputCount Maximum number of inputs (6 or 12)
 * @returns CAT20GuardConstState
 */
function createMultiSendGuardState(
    tokenTypeUtxos: UTXO[][],
    tokenTypeReceivers: CAT20Reciever[][],
    actualTokenTypeCount: number,
    maxInputCount: 6 | 12
): CAT20GuardConstState {
    // Create empty guard state
    const guardState = CAT20GuardStateLib.createEmptyState(maxInputCount);

    // Map to track amounts and find actual token type indices
    const tokenInputAmounts = new Map<number, bigint>();
    const tokenOutputAmounts = new Map<number, bigint>();
    const actualTokenTypeIndices: number[] = [];

    // Find which token types are actually being used
    for (let typeIndex = 0; typeIndex < 4; typeIndex++) {
        if (tokenTypeUtxos[typeIndex].length > 0) {
            actualTokenTypeIndices.push(typeIndex);
        }
    }

    // Process input tokens by type
    for (const typeIndex of actualTokenTypeIndices) {
        const utxos = tokenTypeUtxos[typeIndex];
        if (utxos.length === 0) continue;

        // Get script hash from first UTXO of this type
        const scriptHash = sha256(utxos[0].script);

        // Set script hash in guard state
        guardState.tokenScriptHashes[typeIndex] = toByteString(scriptHash);

        // Calculate total input amount for this type
        let totalInputAmount = 0n;
        for (const utxo of utxos) {
            const state = CAT20StateLib.deserializeState(utxo.data);
            totalInputAmount += state.amount;
        }
        tokenInputAmounts.set(typeIndex, totalInputAmount);
        guardState.tokenAmounts[typeIndex] = totalInputAmount;
    }

    // Calculate output amounts by type
    for (const typeIndex of actualTokenTypeIndices) {
        const receivers = tokenTypeReceivers[typeIndex];
        let totalOutputAmount = 0n;
        for (const receiver of receivers) {
            totalOutputAmount += receiver.amount;
        }
        tokenOutputAmounts.set(typeIndex, totalOutputAmount);
    }

    // Calculate burn amounts for each type
    for (const typeIndex of actualTokenTypeIndices) {
        const inputAmount = tokenInputAmounts.get(typeIndex) || 0n;
        const outputAmount = tokenOutputAmounts.get(typeIndex) || 0n;
        const burnAmount = inputAmount - outputAmount;
        assert(burnAmount >= 0n, `Burn amount for type ${typeIndex} is negative: ${burnAmount}`);
        guardState.tokenBurnAmounts[typeIndex] = burnAmount;
    }

    // Build tokenScriptIndexes - mark each input's token type
    let tokenScriptIndexes = guardState.tokenScriptIndexes;
    let currentInputIndex = 0;
    for (const typeIndex of actualTokenTypeIndices) {
        const utxos = tokenTypeUtxos[typeIndex];
        for (let i = 0; i < utxos.length; i++) {
            const before = slice(tokenScriptIndexes, 0n, BigInt(currentInputIndex));
            const after = slice(tokenScriptIndexes, BigInt(currentInputIndex + 1));
            tokenScriptIndexes = before + intToByteString(BigInt(typeIndex), 1n) + after;
            currentInputIndex++;
        }
    }
    guardState.tokenScriptIndexes = tokenScriptIndexes;

    return guardState;
}
