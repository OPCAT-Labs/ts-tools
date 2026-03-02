import { ByteString, ChainProvider, ExtPsbt, Signer, UTXO, UtxoProvider, assert, fill, intToByteString, sha256, toByteString, slice, PubKey, getBackTraceInfo, toHex, markSpent, fromSupportedNetwork } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721GuardStateLib, CAT721StateLib, CAT721, NFT_GUARD_COLLECTION_TYPE_MAX, CAT721GuardConstState, CAT721State } from "../../../../src/contracts";
import { CAT721GuardPeripheral, ContractPeripheral } from "../../../../src/utils/contractPeripheral";
import { Postage } from "../../../../src/typeConstants";
import { applyFixedArray, filterFeeUtxos, toTokenOwnerAddress } from "../../../../src/utils";
import * as opcat from '@opcat-labs/opcat';
import { Transaction } from '@opcat-labs/opcat';

export type CAT721Receiver = {
    address: ByteString;
    localId: bigint;
}
export type NftTransferInfo = {
    inputUtxos: UTXO[]
    receivers: CAT721Receiver[]
    minterScriptHash: ByteString
}
export type MultiNftTransferInfo = {
    collection1: NftTransferInfo
    collection2?: NftTransferInfo
    collection3?: NftTransferInfo
    collection4?: NftTransferInfo
}
export async function multiSendNfts(
    signer: Signer,
    provider: UtxoProvider & ChainProvider,
    nfts: MultiNftTransferInfo,
    maxInputCount: number,
    maxOutputCount: number,
    guardCollectionTypeCapacity: number,  // Guard contract's collection type capacity (2 or 4)
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
    // Extract NFT info from MultiNftTransferInfo
    const collection1NftUtxos = nfts.collection1.inputUtxos;
    const collection1NftReceivers = nfts.collection1.receivers;
    const collection2NftUtxos = nfts.collection2?.inputUtxos || [];
    const collection2NftReceivers = nfts.collection2?.receivers || [];
    const collection3NftUtxos = nfts.collection3?.inputUtxos || [];
    const collection3NftReceivers = nfts.collection3?.receivers || [];
    const collection4NftUtxos = nfts.collection4?.inputUtxos || [];
    const collection4NftReceivers = nfts.collection4?.receivers || [];

    // Build arrays for each collection type's metadata
    const collectionInfos = [
        nfts.collection1,
        nfts.collection2,
        nfts.collection3,
        nfts.collection4
    ];

    // 1. make sure maxInputCount and maxOutputCount are equal and valid: 6 or 12
    assert(maxInputCount === maxOutputCount, `maxInputCount (${maxInputCount}) must equal maxOutputCount (${maxOutputCount})`);
    assert(maxInputCount === 6 || maxInputCount === 12, `maxInputCount must be 6 or 12, got ${maxInputCount}`);

    // 2. validate guard collection type capacity
    assert(guardCollectionTypeCapacity == 2 || guardCollectionTypeCapacity == 4,
           `guardCollectionTypeCapacity must be 2 or 4, got ${guardCollectionTypeCapacity}`);

    // Calculate actual number of collection types being used in this transaction
    const collectionUtxos = [collection1NftUtxos, collection2NftUtxos, collection3NftUtxos, collection4NftUtxos];
    const actualCollectionTypes: number[] = [];
    for (let i = 0; i < guardCollectionTypeCapacity; i++) {
        if (collectionUtxos[i].length > 0) {
            actualCollectionTypes.push(i);
        }
    }
    const actualCollectionTypeCount = actualCollectionTypes.length;

    // Validate actual collection types don't exceed guard capacity
    assert(actualCollectionTypeCount > 0, 'At least one collection type must be provided');
    assert(actualCollectionTypeCount <= guardCollectionTypeCapacity,
           `Actual collection types (${actualCollectionTypeCount}) exceeds guard capacity (${guardCollectionTypeCapacity})`);

    // Helper functions to validate arrays
    const mustEmpty = (array: any[], variableName: string) => {
        assert(array.length === 0, `${variableName} must be empty when guardCollectionTypeCapacity = ${guardCollectionTypeCapacity}`);
    };

    // Validate collection arrays based on guard capacity
    switch (guardCollectionTypeCapacity) {
        case 2:
            // Collection 3, 4 must be empty (both inputs and receivers)
            mustEmpty(collection3NftUtxos, 'collection3NftUtxos');
            mustEmpty(collection3NftReceivers, 'collection3NftReceivers');
            mustEmpty(collection4NftUtxos, 'collection4NftUtxos');
            mustEmpty(collection4NftReceivers, 'collection4NftReceivers');
            break;
        case 4:
            // All 4 types are allowed
            break;
        default:
            // This should never happen due to earlier validation
            assert(false, `Invalid guardCollectionTypeCapacity: ${guardCollectionTypeCapacity}`);
    }

    // calculate the input counts and output counts
    // inputCount = inputNftUtxos + (addFeeInput ? 1 : 0) + 1(guardInput)
    // outputCount = outputNftReceivers + (addFeeChangeOutput ? 1 : 0)
    const addFeeInput = options?.addFeeInput ?? false;
    const addFeeChangeOutput = options?.addFeeChangeOutput ?? false;
    const guardDustLimit = options?.guardDustLimit ?? Postage.GUARD_POSTAGE;

    const totalInputNftUtxos = collection1NftUtxos.length + collection2NftUtxos.length +
                                collection3NftUtxos.length + collection4NftUtxos.length;
    const totalOutputNftReceivers = collection1NftReceivers.length + collection2NftReceivers.length +
                                     collection3NftReceivers.length + collection4NftReceivers.length;

    const inputCount = totalInputNftUtxos + (addFeeInput ? 1 : 0) + 1; // +1 for guardInput
    const outputCount = totalOutputNftReceivers + (addFeeChangeOutput ? 1 : 0);

    // input counts must be <= maxInputCount
    assert(inputCount <= maxInputCount, `inputCount (${inputCount}) exceeds maxInputCount (${maxInputCount})`);

    // output counts must be <= maxOutputCount
    assert(outputCount <= maxOutputCount, `outputCount (${outputCount}) exceeds maxOutputCount (${maxOutputCount})`);

    // Get necessary information
    const pubkey = await signer.getPublicKey();
    const feeChangeAddress = await signer.getAddress();
    let feeUtxos = await provider.getUtxos(feeChangeAddress);
    feeUtxos = filterFeeUtxos(feeUtxos);

    if (feeUtxos.length === 0) {
        throw new Error('Insufficient satoshis input amount');
    }

    const network = await provider.getNetwork();

    // 3. build guard state
    const deployerAddr = toTokenOwnerAddress(feeChangeAddress);
    const guardState = createMultiSendGuardState(
        [collection1NftUtxos, collection2NftUtxos, collection3NftUtxos, collection4NftUtxos],
        [collection1NftReceivers, collection2NftReceivers, collection3NftReceivers, collection4NftReceivers],
        actualCollectionTypeCount,
        maxInputCount,
        deployerAddr
    );

    // Select the appropriate guard based on guard capacity parameters
    const { guard } = CAT721GuardPeripheral.selectCAT721Guard(
        maxInputCount,
        maxOutputCount,
        guardCollectionTypeCapacity
    );
    guard.state = guardState;

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
    // Get backtraces for each collection type
    const allBacktraces: Array<{
        prevTxHex: string;
        prevTxInput: number;
        prevPrevTxHex: string;
    }> = [];

    for (const typeIndex of actualCollectionTypes) {
        const utxos = collectionUtxos[typeIndex];
        const info = collectionInfos[typeIndex];
        if (!info || utxos.length === 0) continue;

        const backtraces = await CAT721GuardPeripheral.getBackTraceInfo(
            info.minterScriptHash,
            utxos,
            provider
        );
        allBacktraces.push(...backtraces);
    }

    // Collect all NFT UTXOs with their type info
    const allNftUtxos = [
        ...collection1NftUtxos,
        ...collection2NftUtxos,
        ...collection3NftUtxos,
        ...collection4NftUtxos,
    ];

    // Create NFT contracts with corresponding type info
    const nftContracts: CAT721[] = [];
    let utxoIndex = 0;
    for (const typeIndex of actualCollectionTypes) {
        const utxos = collectionUtxos[typeIndex];
        const info = collectionInfos[typeIndex];
        if (!info || utxos.length === 0) continue;

        for (let i = 0; i < utxos.length; i++) {
            const contract = new CAT721(
                info.minterScriptHash
            ).bindToUtxo({
                ...utxos[i],
                txHashPreimage: toHex(
                    new Transaction(allBacktraces[utxoIndex].prevTxHex).toTxHashPreimage()
                ),
            });
            nftContracts.push(contract);
            utxoIndex++;
        }
    }

    const sendPsbt = new ExtPsbt({ network });
    const guardInputIndex = nftContracts.length;

    const inputNftStates = allNftUtxos.map((utxo) =>
        CAT721.deserializeState(utxo.data)
    );

    // Add NFT inputs
    for (let index = 0; index < nftContracts.length; index++) {
        sendPsbt.addContractInput(nftContracts[index], (nft, tx) => {
            const address = opcat.Script.fromHex(inputNftStates[index].ownerAddr).toAddress(fromSupportedNetwork(network));
            const sig = tx.getSig(index, {
                address: address.toString()
            });
            return nft.unlock(
                {
                    userPubKey: PubKey(pubkey),
                    userSig: sig,
                    contractInputIndex: -1n,
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

    // Add NFT outputs - need to create them with corresponding collection type info
    const allNftReceivers = [
        ...collection1NftReceivers,
        ...collection2NftReceivers,
        ...collection3NftReceivers,
        ...collection4NftReceivers,
    ];

    const outputNftStates: CAT721State[] = allNftReceivers.map((receiver, index) => ({
        ownerAddr: receiver.address,
        localId: inputNftStates[index].localId,  // Use localId from input NFT states
    }));

    // Create output contracts with corresponding type info
    let receiverIndex = 0;
    const collectionReceivers = [collection1NftReceivers, collection2NftReceivers, collection3NftReceivers, collection4NftReceivers];
    for (const typeIndex of actualCollectionTypes) {
        const receivers = collectionReceivers[typeIndex];
        const info = collectionInfos[typeIndex];
        if (!info || receivers.length === 0) continue;

        for (let i = 0; i < receivers.length; i++) {
            const nft = new CAT721(
                info.minterScriptHash
            );
            nft.state = outputNftStates[receiverIndex];
            sendPsbt.addContractOutput(nft, Postage.NFT_POSTAGE);
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
                return index < outputNftStates.length
                    ? outputNftStates[index].ownerAddr
                    : ContractPeripheral.scriptHash(toHex(output.script));
            })
        );
        const outputLocalIds = fill(-1n, maxOutputCount);
        applyFixedArray(
            outputLocalIds,
            outputNftStates.map((t) => t.localId)
        );
        const nftScriptHashIndexes = fill(-1n, maxOutputCount);
        // Map each output to its collection type index
        let outputIndex = 0;
        for (const typeIndex of actualCollectionTypes) {
            const receivers = collectionReceivers[typeIndex];
            for (let i = 0; i < receivers.length; i++) {
                nftScriptHashIndexes[outputIndex] = BigInt(typeIndex);
                outputIndex++;
            }
        }

        const outputSatoshis = fill(0n, maxOutputCount);
        applyFixedArray(
            outputSatoshis,
            tx.txOutputs.map((output) => output.value)
        );
        const inputCAT721States = fill(
            CAT721StateLib.create(0n, toByteString('')),
            maxInputCount
        );
        applyFixedArray(inputCAT721States, inputNftStates);
        const nextStateHashes = fill(toByteString(''), maxOutputCount);
        applyFixedArray(
            nextStateHashes,
            tx.txOutputs.map((output) => sha256(toHex(output.data)))
        );

        // F14 Fix: Get deployer signature for guard
        const deployerSig = tx.getSig(guardInputIndex, { publicKey: pubkey })

        contract.unlock(
            deployerSig,
            PubKey(pubkey),
            nextStateHashes as any,
            ownerAddrOrScriptHashes as any,
            outputLocalIds as any,
            nftScriptHashIndexes as any,
            outputSatoshis as any,
            inputCAT721States as any,
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
 * Create guard state for multi-NFT send
 * @param collectionNftUtxos Array of UTXOs for each collection type [collection1, collection2, collection3, collection4]
 * @param collectionNftReceivers Array of receivers for each collection type [collection1, collection2, collection3, collection4]
 * @param actualCollectionTypeCount Actual number of collection types being used in this transaction
 * @param maxInputCount Maximum number of inputs (6 or 12)
 * @returns CAT721GuardConstState
 */
function createMultiSendGuardState(
    collectionNftUtxos: UTXO[][],
    collectionNftReceivers: CAT721Receiver[][],
    actualCollectionTypeCount: number,
    maxInputCount: 6 | 12,
    deployerAddr: ByteString
): CAT721GuardConstState {
    // Create empty guard state
    const guardState = CAT721GuardStateLib.createEmptyState(maxInputCount);

    // F14 Fix: Set deployer address (required)
    guardState.deployerAddr = deployerAddr

    // Find which collection types are actually being used
    const actualCollectionTypeIndices: number[] = [];
    for (let typeIndex = 0; typeIndex < 4; typeIndex++) {
        if (collectionNftUtxos[typeIndex].length > 0) {
            actualCollectionTypeIndices.push(typeIndex);
        }
    }

    // Process input NFTs by collection type
    for (const typeIndex of actualCollectionTypeIndices) {
        const utxos = collectionNftUtxos[typeIndex];
        if (utxos.length === 0) continue;

        // Get script hash from first UTXO of this type
        const scriptHash = sha256(utxos[0].script);

        // Set script hash in guard state
        guardState.nftScriptHashes[typeIndex] = toByteString(scriptHash);
    }

    // Build nftScriptIndexes - mark each input's collection type
    let nftScriptIndexes = guardState.nftScriptIndexes;
    let currentInputIndex = 0;
    for (const typeIndex of actualCollectionTypeIndices) {
        const utxos = collectionNftUtxos[typeIndex];
        for (let i = 0; i < utxos.length; i++) {
            const before = slice(nftScriptIndexes, 0n, BigInt(currentInputIndex));
            const after = slice(nftScriptIndexes, BigInt(currentInputIndex + 1));
            nftScriptIndexes = before + intToByteString(BigInt(typeIndex), 1n) + after;
            currentInputIndex++;
        }
    }
    guardState.nftScriptIndexes = nftScriptIndexes;

    return guardState;
}
