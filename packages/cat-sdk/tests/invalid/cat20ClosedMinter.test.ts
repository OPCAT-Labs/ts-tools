import { CAT20ClosedMinter, CAT20, CAT20ClosedMinterState, ConstantsLib, CAT20_AMOUNT, NULL_ADMIN_SCRIPT_HASH } from "../../src/contracts";
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { isLocalTest } from '../utils';
import { testProvider } from '../utils/testProvider';
import { loadAllArtifacts } from '../features/cat20/utils';
import { assert, DefaultSigner, ExtPsbt, fill, getBackTraceInfo, IExtPsbt, PubKey, sha256, Signer, toByteString, toHex, uint8ArrayToHex, UTXO, Genesis, genesisCheckDeploy } from '@opcat-labs/scrypt-ts-opcat';
import { testSigner } from '../utils/testSigner';
import { getDummyUtxo, outpoint2ByteString, toTokenOwnerAddress } from "../../src/utils";
import { ContractPeripheral, CAT20GuardPeripheral } from "../../src/utils/contractPeripheral";
import { Postage } from "../../src/typeConstants";

use(chaiAsPromised)

type MinterInfo = {
    minter: CAT20ClosedMinter,
    backtrace: {
        prevTxHex: string,
        prevTxInput: number,
        prevPrevTxHex: string,
    }
}

isLocalTest(testProvider) && describe('Test invalid mint for cat20ClosedMinter', () => {

    let mainAddress: string;
    let mainPubKey: PubKey
    let mainSigner: Signer = testSigner;
    let signer2: Signer = new DefaultSigner()
    let signer2PubKey: PubKey;
    let signer2Address: string;

    before(async () => {
        loadAllArtifacts();
        mainAddress = await mainSigner.getAddress();
        mainPubKey = PubKey(await mainSigner.getPublicKey());
        signer2Address = await signer2.getAddress();
        signer2PubKey = PubKey(await signer2.getPublicKey());
    });

    it('should succeed when all is set correctly', async () => {
        let minter: MinterInfo = await createMinter();

        minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
            contract.mint(
                {
                    ownerAddr: toTokenOwnerAddress(mainAddress),
                    amount: BigInt(1e3),
                },
                PubKey(mainPubKey),
                curPsbt.getSig(0, { address: mainAddress }),
                BigInt(Postage.MINTER_POSTAGE),
                BigInt(Postage.TOKEN_POSTAGE),
                getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
            )
        });
    })


    it('should fail when the issuer sig is invalid', async () => {
        try {
            let minter: MinterInfo = await createMinter();
            minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3),
                    },
                    PubKey(mainPubKey),
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('signature check failed')).to.be.true
        }
    });
    it('should fail when the issuer pubkey is invalid', async () => {
        try {
            let minter: MinterInfo = await createMinter();
            minter = await mint(minter, BigInt(1e3), (contract, curPsbt) => {
                contract.mint(
                    {
                        ownerAddr: toTokenOwnerAddress(mainAddress),
                        amount: BigInt(1e3),
                    },
                    PubKey(signer2PubKey),
                    curPsbt.getSig(0, { address: signer2Address }),
                    BigInt(Postage.MINTER_POSTAGE),
                    BigInt(Postage.TOKEN_POSTAGE),
                    getBackTraceInfo(minter.backtrace.prevTxHex, minter.backtrace.prevPrevTxHex, minter.backtrace.prevTxInput)
                )
            });
        } catch (error) {
            expect(error.message.includes('owner address is not match to the pubkey')).to.be.true;
        }
    })


    async function createMinter(): Promise<MinterInfo> {
        // Create Genesis contract for proper backtrace validation
        const genesis = new Genesis();

        const genesisPsbt = new ExtPsbt({ network: await testProvider.getNetwork() })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))
            .addContractOutput(genesis, Postage.GENESIS_POSTAGE)
            .change(mainAddress, 1)
            .seal()

        const signedGenesisPsbt = await mainSigner.signPsbt(genesisPsbt.toHex(), genesisPsbt.psbtOptions())
        genesisPsbt.combine(ExtPsbt.fromHex(signedGenesisPsbt))
        genesisPsbt.finalizeAllInputs()

        const genesisUtxo = genesisPsbt.getUtxo(0)!
        const tokenId = `${genesisUtxo.txId}_${genesisUtxo.outputIndex}`
        const genesisOutpoint = outpoint2ByteString(tokenId)

        const cat20ClosedMinter = new CAT20ClosedMinter(toTokenOwnerAddress(mainAddress), genesisOutpoint)

        const minterScriptHash = ContractPeripheral.scriptHash(cat20ClosedMinter)
        const cat20 = new CAT20(minterScriptHash, CAT20GuardPeripheral.getGuardVariantScriptHashes(), false, NULL_ADMIN_SCRIPT_HASH)
        const tokenScriptHash = ContractPeripheral.scriptHash(cat20)
        const minterState: CAT20ClosedMinterState = {
            tokenScriptHash,
        };
        cat20ClosedMinter.state = minterState;

        // Bind Genesis contract to UTXO
        genesis.bindToUtxo(genesisUtxo);

        const deployPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(genesis, genesisCheckDeploy())
            .spendUTXO(genesisPsbt.getChangeUTXO()!)
            .addContractOutput(cat20ClosedMinter, Postage.MINTER_POSTAGE)
            .seal()
        const signedDeployPsbt = await mainSigner.signPsbt(deployPsbt.toHex(), deployPsbt.psbtOptions())
        deployPsbt.combine(ExtPsbt.fromHex(signedDeployPsbt))
        deployPsbt.finalizeAllInputs()

        return {
            minter: cat20ClosedMinter, backtrace: {
                prevTxHex: deployPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: genesisPsbt.extractTransaction().toHex(),
            }
        }
    }

    async function mint(
        minterInfo: MinterInfo,
        mintAmount: CAT20_AMOUNT,
        unlockCall: (contract: CAT20ClosedMinter, curPsbt: IExtPsbt) => void,
    ): Promise<MinterInfo> {
        const { minter, backtrace } = minterInfo;
        const nextMinterState = {
            ...minter.state,
        }
        const nextMinter = minter.next(nextMinterState);
        const cat20 = new CAT20(ContractPeripheral.scriptHash(nextMinter), CAT20GuardPeripheral.getGuardVariantScriptHashes(), false, NULL_ADMIN_SCRIPT_HASH);
        cat20.state = {
            ownerAddr: toTokenOwnerAddress(mainAddress),
            amount: mintAmount,
        }

        const mintPsbt = new ExtPsbt({ network: await testProvider.getNetwork(), maximumFeeRate: 1e8 })
            .addContractInput(minter, (contract, curPsbt) => {
                unlockCall(contract, curPsbt);
            })
            .spendUTXO(getDummyUtxo(mainAddress, 1e8))
            .addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
            .addContractOutput(cat20, Postage.TOKEN_POSTAGE)
            .seal()
        {
            const signedMintPsbt = await mainSigner.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions())
            mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
        }
        {
            const signedMintPsbt = await signer2.signPsbt(mintPsbt.toHex(), mintPsbt.psbtOptions())
            mintPsbt.combine(ExtPsbt.fromHex(signedMintPsbt))
        }
        mintPsbt.finalizeAllInputs()
        return {
            minter: nextMinter,
            backtrace: {
                prevTxHex: mintPsbt.extractTransaction().toHex(),
                prevTxInput: 0,
                prevPrevTxHex: backtrace.prevTxHex,
            }
        }
    }
});