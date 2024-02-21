import {ARepository, TCloseOptions} from '../ARepository';
import {ClientBase, Client, PoolClient, Pool} from 'pg';
import {PgTransactionWrapper} from './PgTransactionWrapper';

/**
 * Postgres base repository implementation,
 * to be extended with specific repositories for each entity or another general layer
 */
export class BasePostgresRepository extends ARepository<PgTransactionWrapper, ClientBase, ClientBase> {
  constructor(
    protected pgConnector: Pool | Client
  ) {
    super()
  }

  /**
   * Never close the Client connection, release pool one though
   */
  protected toCloseDefault: boolean = false;

  /**
   * In case of using pool, it will return a new client from the pool
   * the same client otherwise
   */
  public async startNewSession(): Promise<ClientBase> {
    if(this.pgConnector instanceof Pool) {
      return await this.pgConnector.connect();
    }

    return this.pgConnector;
  }

  /**
   * Get current connection, might be useful for manual control
   * the proxy wrapper made by for() method will set that
   */
  public get currentSession(): ClientBase | undefined {
    return void 0;
  }

  /**
   * Get current transaction, might be useful for manual control
   * the proxy wrapper made by for() method will set that
   */
  public get currentTransaction(): PgTransactionWrapper | undefined {
    return void 0;
  }

  protected isSession(facade: ClientBase): boolean {
    return (facade instanceof Client || facade instanceof PgTransactionWrapper)
  }

  protected isTransaction(facade: ClientBase): boolean {
    return facade instanceof PgTransactionWrapper
  }

  protected async close(facade: ClientBase, options?: TCloseOptions): Promise<void> {
    // No need to close the transaction
    if(facade instanceof PgTransactionWrapper) {
      return;
    }

    // Pool, still release if session has been taken from the pool for a transaction
    if('function' === typeof (facade as PoolClient).release) {
      return (facade as PoolClient).release();
    }

    // Client, close it if it's not a transaction. Never happens if toCloseDefault is false
    if(facade instanceof Client && this.toCloseDefault && options?.isTransaction !== true) {
      return await facade.end();
    }
  }

  protected async beginTransaction(session: ClientBase): Promise<PgTransactionWrapper> {
    const transaction = new PgTransactionWrapper(session);
    await transaction.begin();
    return transaction;
  }

  protected commitTransaction(transaction: PgTransactionWrapper): Promise<void> {
    return transaction.commit();
  }

  protected rollbackTransaction(transaction: any): Promise<void> {
    return Promise.resolve(undefined)
  }
}
