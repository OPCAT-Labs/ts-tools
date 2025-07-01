import {
  method,
  prop,
  SmartContract,
  assert,
  PubKey,
  FixedArray,
  Sig,
  toByteString,
  hash160,
  StructObject,
  TxUtils,
  Int32,
  sha256,
  Bool,
} from '@opcat-labs/scrypt-ts-opcat';

export interface TicTacToeState extends StructObject {
  is_alice_turn: Bool;
  board: FixedArray<Int32, 9>;
}

export class TicTacToe extends SmartContract<TicTacToeState> {
  @prop()
  alice: PubKey;
  @prop()
  bob: PubKey;
  static readonly BOARDLEN = 9;
  @prop()
  static readonly EMPTY: bigint = 0n;
  @prop()
  static readonly ALICE: bigint = 1n;
  @prop()
  static readonly BOB: bigint = 2n;

  constructor(alice: PubKey, bob: PubKey) {
    super(alice, bob);
    this.alice = alice;
    this.bob = bob;
  }

  @method()
  public move(n: bigint, sig: Sig, halfSpentAmountVal: Int32) {
    assert(n >= 0n && n < BigInt(TicTacToe.BOARDLEN));
    assert(this.state.board[Number(n)] == TicTacToe.EMPTY);

    const play = this.state.is_alice_turn ? TicTacToe.ALICE : TicTacToe.BOB;
    const player: PubKey = this.state.is_alice_turn ? this.alice : this.bob;

    assert(this.checkSig(sig, player, 'player signautre check failed'));
    // make the move
    this.state.board[Number(n)] = play;
    this.state.is_alice_turn = !this.state.is_alice_turn;
    const spentAmountVal = halfSpentAmountVal + halfSpentAmountVal;
    assert(spentAmountVal == this.ctx.value);

    let outputs = toByteString('');
    if (this.won(play)) {
      outputs = TxUtils.buildP2PKHOutput(this.ctx.value, hash160(player));
    } else if (this.full()) {
      const aliceOutput = TxUtils.buildP2PKHOutput(
        halfSpentAmountVal,
        hash160(this.alice),
      );
      const bobOutput = TxUtils.buildP2PKHOutput(
        halfSpentAmountVal,
        hash160(this.bob),
      );
      outputs = aliceOutput + bobOutput;
    } else {
      outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, TicTacToe.stateHash(this.state));
    }

    outputs += this.buildChangeOutput();

    assert(this.checkOutputs(outputs), "invalid outputs");
  }

  @method()
  won(play: bigint): boolean {
    const lines: FixedArray<FixedArray<Int32, 3>, 8> = [
      [0n, 1n, 2n],
      [3n, 4n, 5n],
      [6n, 7n, 8n],
      [0n, 3n, 6n],
      [1n, 4n, 7n],
      [2n, 5n, 8n],
      [0n, 4n, 8n],
      [2n, 4n, 6n],
    ];

    let anyLine = false;

    for (let i = 0; i < 8; i++) {
      let line = true;
      for (let j = 0; j < 3; j++) {
        line = line && this.state.board[Number(lines[i][j])] == play;
      }

      anyLine = anyLine || line;
    }

    return anyLine;
  }

  @method()
  full(): boolean {
    let full = true;
    for (let i = 0; i < TicTacToe.BOARDLEN; i++) {
      full = full && this.state.board[i] != TicTacToe.EMPTY;
    }
    return full;
  }
}
