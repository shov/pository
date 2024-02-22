import { connectPgClient, createPgPool, migrationDown, migrationUp, PhoneRepo, UserRepo } from './fixtureKit';
import exp from 'constants';

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
    const createdUser = await repo.create({ name: 'John' });

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
    const createdUser = await repo.create({ name: 'John' });

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

  it('Transaction query with client object', async () => {
    // Arrange
    const client = await connectPgClient();

    const userRepo = new UserRepo(client);
    const phoneRepo = new PhoneRepo(client);

    // Act
    await userRepo.transaction(async (transaction) => {
      const uR = userRepo.for(transaction);
      const pR = phoneRepo.for(transaction);

      const user = await uR.create({ name: 'John' });
      const phone = await pR.create({ phone: '123', user_id: user.id });
    });

    let thrown = false;
    try {
      await userRepo.transaction(async (transaction) => {
        const uR = userRepo.for(transaction);
        const pR = phoneRepo.for(transaction);

        const user = await uR.create({ name: 'Jane' });
        const phone = await pR.create({ phone: '123', user_id: user.id });
      });
    } catch (e) {
      thrown = true;
    }

    const john = await userRepo.getByName('John');
    const jane = await userRepo.getByName('Jane');
    const phone = await phoneRepo.getByPhone('123');

    // Assert
    expect(thrown).toBe(true);
    expect(john).not.toBeNull();
    expect(john.name).toBe('John');
    expect(typeof john.id).toBe('number');
    expect(jane).toBeNull();
    expect(phone).not.toBeNull();
    expect(phone.phone).toBe('123');
    expect(phone.user_id).toBe(john.id);

    await client.end();
  });
});
