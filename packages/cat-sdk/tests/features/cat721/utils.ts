import { CAT721, CAT721ClosedMinter, CAT721Guard_6_6_2, CAT721Guard_6_6_4, CAT721Guard_12_12_2, CAT721Guard_12_12_4, CAT721GuardStateLib, CAT721OpenMinter, CAT721OpenMinterMetadata, CAT721StateLib, ClosedMinterCAT721Meta, MerkleProof, OpenMinterCAT721Meta, ProofNodePos } from "../../../src/contracts"
import { readArtifact } from "../../utils"
import { ByteString, getUtxoKey, UTXO } from "@opcat-labs/scrypt-ts-opcat"
import { testSigner } from "../../utils/testSigner"
import { testProvider } from "../../utils/testProvider"
import { deploy } from "../../../src/features/cat721/deploy/cat721ClosedMinter"
import { mintNft as mint } from "../../../src/features/cat721/mint/cat721ClosedMinter"
import { toTokenOwnerAddress } from "../../../src/utils"
import { singleSendNft as singleSend } from "../../../src/features/cat721/send/singleSend"
import { CAT721OpenMintInfo } from "../../../src/contracts/cat721/minters/cat721OpenMintInfo"

export const loadAllArtifacts = function () {
    CAT721ClosedMinter.loadArtifact(
      readArtifact('artifacts/cat721/minters/cat721ClosedMinter.json')
    )
    CAT721OpenMinter.loadArtifact(
      readArtifact('artifacts/cat721/minters/cat721OpenMinter.json')
    )
    CAT721OpenMintInfo.loadArtifact(
      readArtifact('artifacts/cat721/minters/cat721OpenMintInfo.json')
    )
    CAT721.loadArtifact(
      readArtifact('artifacts/cat721/cat721.json')
    )
    CAT721StateLib.loadArtifact(
      readArtifact('artifacts/cat721/cat721StateLib.json')
    )
    CAT721Guard_6_6_2.loadArtifact(
      readArtifact('artifacts/cat721/cat721Guard_6_6_2.json')
    )
    CAT721Guard_6_6_4.loadArtifact(
      readArtifact('artifacts/cat721/cat721Guard_6_6_4.json')
    )
    CAT721Guard_12_12_2.loadArtifact(
      readArtifact('artifacts/cat721/cat721Guard_12_12_2.json')
    )
    CAT721Guard_12_12_4.loadArtifact(
      readArtifact('artifacts/cat721/cat721Guard_12_12_4.json')
    )
    CAT721GuardStateLib.loadArtifact(
      readArtifact('artifacts/cat721/cat721GuardStateLib.json')
    )
}

export async function deployNft(info: ClosedMinterCAT721Meta) {
  return deploy(
    testSigner,
    testProvider,
    info,
    await testProvider.getFeeRate()
  )
}

export async function mintNft(
  cat721MinterUtxo: UTXO,
  collectionId: string,
  info: ClosedMinterCAT721Meta,
) {
  const changeAddress = await testSigner.getAddress()
  const nftReceiverAddr = toTokenOwnerAddress(changeAddress)

  const state = CAT721ClosedMinter.deserializeState(cat721MinterUtxo.data)

  const nft = {
    contentType: 'image/png',
    contentBody: 'mint collection ' + collectionId + ' nft ' + state.nextLocalId.toString(),
    nftmetadata: {
      image: 'https://example.com/' + `${collectionId}_${state.nextLocalId}.png`,
      localId: state.nextLocalId,
    },
  }

  return mint(
    testSigner,
    testSigner,
    testProvider,
    cat721MinterUtxo,
    nft,
    collectionId,
    info,
    nftReceiverAddr,
    changeAddress,
    [],
    await testProvider.getFeeRate()
  )
}

export async function singleSendNft(
  minterScriptHash: string,
  inputNftUtxos: UTXO[],
  tokenReceiverAddr: ByteString[]
) {
  const address = await testSigner.getAddress()
  return singleSend(
    testSigner,
    testProvider,
    minterScriptHash,
    inputNftUtxos,
    tokenReceiverAddr,
    await testProvider.getFeeRate()
  )
}