import {connectPgClient, createPgPool, migrationDown, migrationUp, UserRepo} from './fixtureKit';

describe('PostgresRepo', () => {
  beforeAll(async () => {
    await migrationUp();
  });

  afterAll(async () => {
    await migrationDown();
  });

  it('Simple query with client object', async () => {
    // Arrange
    const client = await connectPgClient();

    const repo = new UserRepo(client);

    // Act
    const createdUser = await repo.create({name: 'John'});

    // Assert
    expect(createdUser.name).toBe('John');
    expect(typeof createdUser.id).toBe('number');
    const id = createdUser.id;

    // Act
    const userFromDbFound = await repo.getById(id);
    const userFromDbNotFound = await repo.getById(id + 1);

    // Assert
    expect(userFromDbFound).toEqual(createdUser);
    expect(userFromDbNotFound).toBeNull();

    await client.end();
  });

  it('Simple query with pool object', async () => {
    // Arrange
    const pool = createPgPool();

    const repo = new UserRepo(pool);

    // Act
    const createdUser = await repo.create({name: 'John'});

    // Assert
    expect(createdUser.name).toBe('John');
    expect(typeof createdUser.id).toBe('number');
    const id = createdUser.id;

    // Act
    const userFromDbFound = await repo.getById(id);
    const userFromDbNotFound = await repo.getById(id + 1);

    // Assert
    expect(userFromDbFound).toEqual(createdUser);
    expect(userFromDbNotFound).toBeNull();

    await pool.end();
  });
});
