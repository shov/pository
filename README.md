# POSITORY

## Session and Transaction, for()

There are options to create and get new session. Session means sessions for Mongo or Neo4j, means new connection of Client or from Pool for Postgres.

Threre is a way to wrap code in a transaction:

```typescript
const result = await this.userRepo.transaction(async tx => {
  const userRepo = this.userRepo.for(tx);
  const user = await userRepo.getById(userId);
  if(!user) {
    throw new Error('User not found');
  }
  
  const commentList = await this.commentService.fetchForUserId(userId, tx); // pass tx object
  const notCoupledCommentList = await this.bus.call(EVENT.commentService.fetchForUserId, {
    userId,
    transaction: tx,
  });
});
```

Here `tx` is a transaction object. Using `for()` we make transaction bound repo object. 

We also can use `startNewSession()` to get new connection or session, it's not going to be bound to the repo we call it onto. 

However then we may do `.for(newSession)` to get repo bound to the session.

If we never did `for()` the repo object keep using newSession under the hood, never close / release it if configured that way. protected toCloseDefault: boolean 

```mermaid
---
title: default session
---
flowchart TD
    1[no session either connection]
    2["by first db() call new session set by default"]
    3["session never close, but PG Pool release"]
    
    1 --> 2 --> 3
    
```

Highly reccomend to use Pool connection for Postgres. 

```mermaid
---
title: for(newSession)
---
flowchart TD
	1[repo object bound to passed session]
	2["after db() call the session will be close by toCloseDefault"]
	3["to close it use native driver methods on session object"]
	1 --> 2 -.-> 3
	
```

```mermaid
---
title: for(transaction)
---
flowchart TD
	a11["repo object bound to transaction by for(), default session set"]
	a12["repo object bound to transaction by for(), default session not set"]
	a121["default session created and set"]
	a2[after db call it never releases the session]
	a3[after transaction close session never close, but PG Pool release]
	a11 --> a2 --> a3
	a12 --> a121 --> a2
	b1["repo object had been bound to session by for()"]
	b2["repo object bound to transaction by for()"]
	b3["after db() call it never releases the session"]
	b4[after transaction close session will be close by toCloseDefault]
	b1 --> b2 --> b3 --> b4
```

