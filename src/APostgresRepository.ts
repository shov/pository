import {ARepository} from './ARepository';
import {ClientBase} from 'pg';

export class PostgresRepository extends ARepository<any, ClientBase, ClientBase> {
  constructor() {
    super()
  }
}
