import { ByteString, ChainProvider, min, Signer, UTXO, UtxoProvider } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20_AMOUNT, NULL_ADMIN_SCRIPT_HASH, TX_INPUT_COUNT_MAX } from "../../../contracts/index.js";
import { toTokenOwnerAddress, createFeatureWithDryRun } from "../../../utils/index.js";
import { singleSend } from "./singleSend.js";


const MAX_INPUT_TOKEN_UTXOS_PER_TRANSFER = TX_INPUT_COUNT_MAX - 2; // 2 for guard input and fee input;

export function calculateTokenTransferCount(inputTokenUtxos: number): number {
    if (inputTokenUtxos <= MAX_INPUT_TOKEN_UTXOS_PER_TRANSFER) {
        return 1;
    }
    const leftCount = inputTokenUtxos % MAX_INPUT_TOKEN_UTXOS_PER_TRANSFER;
    const mergeCount = (inputTokenUtxos - leftCount) / MAX_INPUT_TOKEN_UTXOS_PER_TRANSFER;
    return mergeCount + calculateTokenTransferCount(mergeCount + leftCount);
}

type SingleSendResult = Awaited<ReturnType<typeof singleSend>>;

export const mergeSendToken = createFeatureWithDryRun(async function(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  minterScriptHash: ByteString,
  inputTokenUtxos: UTXO[],
  receivers: Array<{
    address: ByteString
    amount: CAT20_AMOUNT
  }>,
  tokenChangeAddress: ByteString,
  feeRate: number,
  hasAdmin: boolean = false,
  adminScriptHash: ByteString = NULL_ADMIN_SCRIPT_HASH,
  sendChangeData?: Buffer,
  progressCallbacks?: {
    onTransferStart?: (progress: { currentIndex: number; totalTransfers: number; isFinalSend: boolean }) => void;
    onTransferEnd?: (progress: { currentIndex: number; totalTransfers: number; isFinalSend: boolean; result: SingleSendResult }) => void;
  }
): Promise<{
    merges: SingleSendResult[],
    finalSend: SingleSendResult
}> {
    let transferCount = calculateTokenTransferCount(inputTokenUtxos.length);
    const changeAddress  = await signer.getAddress();
    const mergeTokenAddress = toTokenOwnerAddress(changeAddress);

    inputTokenUtxos = inputTokenUtxos.slice(); // make a copy

    // merges
    let mergeResults:  SingleSendResult[] = [];
    for (let i = 0; i < transferCount - 1; i++) {
        progressCallbacks?.onTransferStart?.({ currentIndex: i, totalTransfers: transferCount, isFinalSend: false });

        const mergeInputUtxos = inputTokenUtxos.splice(0, MAX_INPUT_TOKEN_UTXOS_PER_TRANSFER);
        const singleSendRes = await singleSend(
            signer,
            provider,
            minterScriptHash,
            mergeInputUtxos,
            [], // leave it empty, so all tokens will be sent to change address
            mergeTokenAddress,
            feeRate,
            hasAdmin,
            adminScriptHash,
        );
        inputTokenUtxos.push(...singleSendRes.newCAT20Utxos)
        mergeResults.push(singleSendRes);

        progressCallbacks?.onTransferEnd?.({ currentIndex: i, totalTransfers: transferCount, isFinalSend: false, result: singleSendRes });
    }

    // final send
    const finalSendIndex = transferCount - 1;
    progressCallbacks?.onTransferStart?.({ currentIndex: finalSendIndex, totalTransfers: transferCount, isFinalSend: true });

    const finalSend = await singleSend(
        signer,
        provider,
        minterScriptHash,
        inputTokenUtxos,
        receivers,
        tokenChangeAddress,
        feeRate,
        hasAdmin,
        adminScriptHash,
        sendChangeData
    );

    progressCallbacks?.onTransferEnd?.({ currentIndex: finalSendIndex, totalTransfers: transferCount, isFinalSend: true, result: finalSend });

    return {
        merges: mergeResults,
        finalSend
    }
})