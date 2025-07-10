'use strict';
import util from './util/index.js';
import encoding from './encoding/index.js';
import crypto from './crypto/index.js';
import errors from './errors/index.js';
import Address from './address.js';
import Block from './block/index.js';
import MerkleBlock from './block/merkleblock.js';
import BlockHeader from './block/blockheader.js';
import HDPrivateKey from './hdprivatekey.js';
import HDPublicKey from './hdpublickey.js';
import Networks from './networks.js';
import Network from './network.js';
import Opcode from './opcode.js';
import PrivateKey from './privatekey.js';
import PublicKey from './publickey.js';
import Script from './script/index.js';
import Transaction from './transaction/index.js';
import Output from './transaction/output.js';
import Input from './transaction/input/index.js';
import Sighash from './transaction/sighash.js';
import TransactionSignature from './transaction/signature.js';
import HashCache from './hash-cache.js';
import Message from './message/message.js';
import Mnemonic from './mnemonic/index.js';
import Interpreter from './interpreter/index.js';


export default {
  Address,
  Block,
  MerkleBlock,
  BlockHeader,
  HDPrivateKey,
  HDPublicKey,
  Sighash,
  TransactionSignature,
  Output,
  Input,
  PublicKeyInput: Input.PublicKey,
  PublicKeyHashInput: Input.PublicKeyHash,
  MultiSigInput: Input.MultiSig,
  Networks,
  Network,
  Opcode,
  PrivateKey,
  PublicKey,
  Script,
  Interpreter,
  Transaction,
  HashCache,
  Message,
  Mnemonic,
  errors,
  util,
  encoding,
  crypto,
};

export const PublicKeyInput = Input.PublicKey;
export const PublicKeyHashInput = Input.PublicKeyHash;
export const MultiSigInput = Input.MultiSig;
export { Address, Block, MerkleBlock, BlockHeader, HDPrivateKey, HDPublicKey, Networks, Network, Opcode, PrivateKey, PublicKey, Script, Interpreter, Transaction, Input, Sighash, TransactionSignature, Output, HashCache, Message, Mnemonic, errors, util, encoding, crypto };



