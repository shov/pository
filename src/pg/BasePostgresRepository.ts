import { ARepository, TCloseOptions } from '../ARepository';
import { ClientBase, Client, PoolClient, Pool } from 'pg';
import { PgTransactionWrapper } from './PgTransactionWrapper';

/**
 * Postgres base repository implementation,
 * to be extended with specific repositories for each entity or another general layer
 */
export class BasePostgresRepository extends ARepository<PgTransactionWrapper, ClientBase, ClientBase> {
  constructor(
    protected pgConnector: Pool | Client,
  ) {
    super();
  }

  /**
   * In case of using pool, it will return a new client from the pool
   * the same client otherwise
   */
  public async startNewSession(): Promise<ClientBase> {
    if (this.pgConnector instanceof Pool) {
      return await this.pgConnector.connect();
    }

    return this.pgConnector;
  }

  protected _currentSession: ClientBase | undefined;

  public get currentSession(): ClientBase | undefined {
    return this._currentSession;
  }

  public get currentTransaction(): PgTransactionWrapper | undefined {
    return void 0;
  }

  protected set currentSession(session: ClientBase | undefined) {
    this._currentSession = session;
  }

  protected isSession(facade: ClientBase): boolean {
    return (facade instanceof Client || !(facade instanceof PgTransactionWrapper));
  }

  protected isTransaction(facade: ClientBase): boolean {
    return facade instanceof PgTransactionWrapper;
  }

  protected async close(facade: ClientBase, options?: TCloseOptions): Promise<void> {
    // No need to close the transaction
    if (facade instanceof PgTransactionWrapper) {
      return;
    }

    // Pool, release
    if ('function' === typeof (facade as PoolClient).release) {
      (facade as PoolClient).release();
      this.currentSession = void 0;
    }

    // Client, close it if it's not a transaction. Never happens if toCloseDefault is false
    if (facade instanceof Client && options?.force === true) {
      await facade.end();
      this.currentSession = void 0;
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

  protected rollbackTransaction(transaction: PgTransactionWrapper): Promise<void> {
    return transaction.rollback();
  }
}
