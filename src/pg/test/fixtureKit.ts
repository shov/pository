import {Client, Pool, PoolClient} from 'pg';
import {BasePostgresRepository} from '../BasePostgresRepository'
import {TNullable} from '../../types'

const DB_CRED = {
  USER: 'default',
  HOST: 'localhost',
  DATABASE: 'default',
  PASSWORD: 'secret',
  PORT: 5432,
};

export async function connectPgClient(): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    const client = new Client({
      user: DB_CRED.USER,
      host: DB_CRED.HOST,
      database: DB_CRED.DATABASE,
      password: DB_CRED.PASSWORD,
      port: DB_CRED.PORT,
    });
    client.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(client);
      }
    });
  });
}

export function createPgPool(): Pool {
  return new Pool({
    user: DB_CRED.USER,
    host: DB_CRED.HOST,
    database: DB_CRED.DATABASE,
    password: DB_CRED.PASSWORD,
    port: DB_CRED.PORT,
  });
}

export async function migrationUp() {
  const client = await connectPgClient();
  await client.query(
    // language=PostgreSQL
    `
        CREATE TABLE IF NOT EXISTS users
        (
            id   SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        );
    `);
  await client.end();
}

export async function migrationDown() {
  const client = await connectPgClient();
  await client.query(
    // language=PostgreSQL
    `
        DROP TABLE IF EXISTS users;
    `);
  await client.end();
}

type TUser = {
  id?: number,
  name: string,
}

export class UserRepo extends BasePostgresRepository {
  public async create(user: TUser): Promise<TUser> {
    return await this.db(async (facade) => {
      const result = await facade.query<TUser>(
        // language=PostgreSQL
        `
            INSERT INTO users (name)
            VALUES ($1)
            RETURNING *;
        `,
        [user.name],
      );

      return result.rows[0];
    });
  }

  public async getById(id: number): Promise<TNullable<TUser>> {
    return await this.db(async (facade) => {
      const result = await facade.query<TUser>(
        // language=PostgreSQL
        `
            SELECT *
            FROM users
            WHERE id = $1
            LIMIT 1;
        `,
        [id],
      );

      return result.rows[0] || null;
    });
  }
}
