import {ClientBase} from 'pg';

export enum EPgTransactionWrapperState {
  NOT_STARTED = 'not_started',
  OPEN = 'open',
  CLOSED = 'closed'
}

export interface PgTransactionWrapper extends ClientBase {
}

export class PgTransactionWrapper {
  protected _client: ClientBase;

  constructor(client: ClientBase) {
    this._client = client;

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        return Reflect.get(target._client, prop, receiver);
      }
    });
  }

  public id: string;

  protected state: EPgTransactionWrapperState = EPgTransactionWrapperState.NOT_STARTED;

  public async begin(): Promise<void> {
    if (this.state !== EPgTransactionWrapperState.NOT_STARTED) {
      throw new Error('Transaction is already started');
    }
    const result = await this.query('BEGIN');
    this.id = result.rows[0].id;
  }

  public async commit(): Promise<void> {
    if (this.state !== EPgTransactionWrapperState.OPEN) {
      throw new Error('Transaction is not open');
    }
    await this.query('COMMIT');
    this.state = EPgTransactionWrapperState.CLOSED;
  }

  public async rollback(): Promise<void> {
    if (this.state !== EPgTransactionWrapperState.OPEN) {
      throw new Error('Transaction is not open');
    }
    await this.query('ROLLBACK');
    this.state = EPgTransactionWrapperState.CLOSED;
  }
}

Object.defineProperty(PgTransactionWrapper, Symbol.hasInstance, {
  value: function (instance: any) {
    return instance instanceof PgTransactionWrapper || instance['_client'] instanceof ClientBase;
  }
});
