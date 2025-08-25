import { method, prop, SmartContract, assert, sha256, hash256 } from '@opcat-labs/scrypt-ts';

// Enum representing shipping status
enum Status {
  Pending,
  Shipped,
  Accepted,
  Rejected,
  Canceled,
}

export class Enum2 extends SmartContract {
  @prop()
  status: Status;

  constructor(status: Status) {
    super(...arguments);
    this.status = status;
  }

  @method()
  get(): Status {
    return this.status;
  }

  // Update status by passing uint into input
  @method()
  set(status: Status): void {
    this.status = status;
  }

  @method()
  public unlock() {
    let s = this.get();
    assert(s == Status.Pending, 'invalid stauts');

    this.set(Status.Accepted);

    s = this.get();

    assert(s == Status.Accepted, 'invalid stauts');

    assert(this.ctx.hashOutputs == hash256(this.buildChangeOutput()), 'hashOutputs check failed');
  }
}
