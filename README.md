Local Startup guide

First create a local postgres database with a username and password of `root`, and a db name of `warroom_blackjack`

Second create a .env file like this
```
DATABASE_URL="postgresql://root:root@localhost:5432/warroom_blackjack?schema=public"
```

Run
```
npm i

npx prisma migrate dev

npm run dev
```

Server should start on `http://localhost:3000`
