export type TTransactionOptions<TTransaction = any> = {
  /**
   * Specify external transaction object
   */
  externalTransaction: TTransaction;
  /**
   * Called if an externalTransaction provided
   * It's allowed to stack multiple callbacks on any level of transaction,
   * so all the set callbacks will be eventually executed in case of rollback
   */
  onRollbackCb: (transaction: TTransaction) => any;
}

export type TCloseOptions = {
  isTransaction?: boolean;
  force?: boolean;
}

export abstract class ARepository<TTransaction extends TQueryFacade = any, TSession extends TQueryFacade = any, TQueryFacade = any> {
  protected static transactionErrorPayloadMap
    = new WeakMap<Error, { rollbackCbList: ((...args: any[]) => any)[] }>();

  public abstract startNewSession(): TSession | Promise<TSession>;

  public abstract get currentSession(): TSession | undefined;

  public abstract get currentTransaction(): TTransaction | undefined;

  protected abstract set currentSession(session: TSession | undefined);

  protected abstract isSession(facade: TQueryFacade): boolean;

  protected abstract isTransaction(facade: TQueryFacade): boolean;

  protected abstract close(facade: TQueryFacade, options?: TCloseOptions): Promise<void>;

  protected abstract beginTransaction(session: TSession): TTransaction | Promise<TTransaction>;

  protected abstract commitTransaction(transaction: TTransaction): Promise<void>;

  protected abstract rollbackTransaction(transaction: TTransaction): Promise<void>;

  /**
   * Can be used to correctly release the resources
   */
  public finalize(cb?: (e?: any) => void): Promise<void> | void {
    if (!this.currentSession) {
      return;
    }

    if (cb) {
      this.close(this.currentSession, { force: true })
        .then(_ => cb())
        .catch(e => cb(e));
      return;
    }

    return new Promise((r, j) => {
      this.close(this.currentSession, { force: true })
        .then(_ => r())
        .catch(e => j(e));
    });
  }

  /**
   * Run code in transaction
   * Supports external transaction
   */
  public async transaction<R = any>(
    cb: (transaction: TTransaction) => Promise<R>,
    options?: TTransactionOptions<TTransaction>,
  ): Promise<R> {
    // External transaction
    if (options?.externalTransaction) {
      try {
        return await Promise.resolve(cb(options.externalTransaction));
      } catch (e) {
        // Pass it up to the root transaction to be executed there
        if ('function' === typeof options?.onRollbackCb) {
          const payload
            = ARepository.transactionErrorPayloadMap.get(e)
            ?? { rollbackCbList: [] };

          payload.rollbackCbList.push(options.onRollbackCb);
          ARepository.transactionErrorPayloadMap.set(e, payload);
        }
        throw e;
      }
    }

    // Regular case
    if (!this.currentSession) {
      // If no session set by .for() and no default session.
      // The default session will be created.
      this.currentSession = await this.startNewSession();
    }
    const session = this.currentSession;

    let tx: TTransaction;
    try {
      tx = await Promise.resolve(this.beginTransaction(session));
      const result = await Promise.resolve(cb(tx));
      await this.commitTransaction(tx);
      return result;
    } catch (e) {
      await this.rollbackTransaction(tx);

      // Add to the rest of rollback callbacks
      if ('function' === typeof options?.onRollbackCb) {
        const payload =
          ARepository.transactionErrorPayloadMap.get(e)
          ?? { rollbackCbList: [] };
        payload.rollbackCbList.push(options.onRollbackCb);

        ARepository.transactionErrorPayloadMap.set(e, payload);
      }

      // Execute rollback callbacks
      const payload =
        ARepository.transactionErrorPayloadMap.get(e)
        ?? { rollbackCbList: [] };

      await Promise.allSettled(
        payload.rollbackCbList.map(async cb => Promise.resolve(cb(tx))),
      );

      throw e;
    } finally {
      await this.close(tx);
      await this.close(session, { isTransaction: true });
    }
  }

  public for(session: TSession): typeof this;
  public for(transaction: TTransaction): typeof this;
  /**
   * Wrap repository object so any the repository action will be executed in the context
   * of the provided session or transaction
   */
  public for(ref: TSession | TTransaction): typeof this {
    if (this.isSession(ref)) {
      if (this.currentTransaction) {
        throw new Error(
          'Cannot set session, transaction context is already set',
        );
      }

      return new Proxy<typeof this>(this, {
        get: (target, prop, receiver) => {
          if (prop === 'currentSession') {
            return ref;
          }
          return Reflect.get(target, prop, receiver);
        },
        set(target: ARepository<TTransaction, TSession, TQueryFacade>, p: string | symbol, newValue: any, receiver: any): boolean {
          if (p === 'currentSession') {
            throw new Error('Cannot set session, session context is already set');
          }
          return Reflect.set(target, p, newValue, receiver);
        },
      });
    }
    if (this.isTransaction(ref)) {
      if (this.currentTransaction) {
        throw new Error('Cannot set transaction, transaction context is already set');
      }

      return new Proxy<typeof this>(this, {
        get: (target, prop, receiver) => {
          if (prop === 'currentTransaction') {
            return ref;
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    }
    throw new Error('Unknown ref type');
  }

  /**
   * Wrap every repository action code to access the database
   * Example:
   *  ```typescript
   *  public async getById(id: string): Promise<TNullable<User>> {
   *    return await this.db(async (facade) => {
   *      const result = await facade.execute('GET FROM users WHERE id = $1', { id });
   *      return result ? makeDTO(result) : null;
   *    });
   *  }
   *  ````
   */
  protected async db<R = any>(
    cb: (facade: TQueryFacade) => Promise<R>,
  ): Promise<R> {
    let facade =
      this.currentTransaction // Transaction has the highest priority
      || this.currentSession; // Then session if set

    if (!facade) { // The session is not set by .for(), create and set the default session
      this.currentSession = await this.startNewSession();
      facade = this.currentSession;
    }

    try {
      return await cb(facade);
    } catch (e) {
      throw e;
    } finally {
      await this.close(facade);
    }
  }
}
