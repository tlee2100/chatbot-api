<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Day 6 assignment — a NestJS REST API and WebSockets server with JWT authentication, role-based access control, TypeORM/PostgreSQL persistence, Swagger documentation, and real-time Chat features.</p>

## Description

This project is the Day 6 NestJS assignment. It implements a multi-tenant "site management" API and real-time Chat server with the following modules:

- **Auth & Notifications** — email/password login, JWT access tokens, and WebSocket notifications.
- **User** — user registration/CRUD, password hashing, and role assignment.
- **Site** — creation of "sites" owned by a user, protected by JWT auth.
- **Chat** — WebSocket-based real-time chat with presence tracking, typing indicators, and message delivery status.
- **Document & Organization** — support for file uploads and organizational structures.

Data is persisted in PostgreSQL through TypeORM, with schema changes tracked as versioned migrations. API endpoints are documented and explorable through Swagger UI. WebSockets handle real-time chat and notifications.

## Tech stack

- [NestJS 11](https://docs.nestjs.com/) (Express platform) + `@nestjs/websockets` / `socket.io`
- [TypeORM](https://typeorm.io/) + PostgreSQL (`pg`)
- [@nestjs/jwt](https://docs.nestjs.com/security/authentication) + [Passport](http://www.passportjs.org/) (`passport-jwt`) for authentication
- [class-validator](https://github.com/typestack/class-validator) / `class-transformer` for DTO validation
- [@automapper/nestjs](https://automapperts.netlify.app/) for entity → DTO mapping
- [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) for API documentation
- `bcrypt` for password hashing
- **AI & Agents**: [LangGraph](https://langchain-ai.github.io/langgraphjs/) + [LangChain](https://js.langchain.com/) for AI agent workflow (intent classification, tool usage, memory summarization)
- **Model**: integration with `deepseek-v4-flash` via OpenAI endpoints.
- **Protocol**: Model Context Protocol (MCP) clients and adapters for dynamic AI tools.

## Project structure

```text
src/
├── auth/            # Login endpoint, JWT strategy, roles guard, WS guard, Notifications
├── user/            # User entity, DTOs, service, controller (CRUD)
├── site/            # Site entity, DTO, service, controller
├── chat/            # Chat entities, service, controller, and WebSocket gateway
├── document/        # Document uploads and management
├── organization/    # Organization entities and services
├── database/        # TypeORM DataSource and migrations
├── app.module.ts    # Root module wiring up DB, WebSockets, and modules
└── main.ts          # Bootstrap flow, CORS config, ValidationPipe, Swagger setup
```

## Bootstrap & Origins

The application bootstraps in `src/main.ts`, setting up:
- **CORS**: Configured to allow origins from `process.env.FRONTEND_URL` (defaults to `http://localhost:3001`). This applies to both REST API endpoints and WebSocket connections (which use `cors: { origin: '*' }` for broad accessibility, though can be restricted based on environment).
- **Global Pipes**: Uses `ValidationPipe` for automatic DTO validation.
- **Swagger**: Available at `/api` for API documentation.
- **Port**: Listens on `process.env.PORT` (defaults to `3000`).

WebSocket gateways:
- `ChatGateway` (Default namespace): Handles real-time chat between visitors and agents.
- `NotificationsGateway` (`/notifications` namespace): Handles system/dashboard notifications.

## Setup

### Prerequisites

- Node.js (LTS) and npm
- Docker (for the bundled PostgreSQL container) or an existing PostgreSQL instance

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (values below match `docker-compose.yaml`):

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123456
DB_DATABASE=nestjs_db

JWT_SECRET=<your-secret-key>

# AI & MCP Configuration
OPENAI_API_KEY=<your-deepseek-api-key>
INTERNAL_API_KEY=super-secret-key-36
MCP_SERVER_URL=http://localhost:3002/mcp/sse
```

`ConfigModule` is loaded globally in `app.module.ts`, so any variable here is available via `ConfigService` (and `data-source.ts` reads the same variables through `dotenv/config` for the TypeORM CLI).

### 3. Start PostgreSQL

The repo ships a `docker-compose.yaml` that provisions a `pgvector/pgvector:pg16` container matching the `.env` values above. The `pgvector` extension is required for vector embeddings and hybrid search functionality:

```bash
docker compose up -d
```

This starts a `chatbot-db` container exposing PostgreSQL on `localhost:5432`, with data persisted in the `postgres_data` volume.

### 4. Run database migrations

See [Migrations](#migrations) below — run `npm run migration:run` before starting the app for the first time.

### 5. Run the application

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

The API listens on `http://localhost:3000`.

## Migrations

Schema management uses TypeORM migrations against the `DataSource` defined in [src/database/data-source.ts](src/database/data-source.ts). `synchronize` is disabled in `app.module.ts`, so **all schema changes must go through migrations**.

| Script | Purpose |
| --- | --- |
| `npm run migration:generate` | Generates a new migration file in `src/database/migrations/` by diffing entities against the current DB schema (base name `Init`, adjust as needed). |
| `npm run migration:run` | Applies all pending migrations to the configured database. |
| `npm run typeorm` | Runs the raw `typeorm-ts-node-commonjs` CLI (e.g. for `migration:revert`, `migration:show`). |

Common workflow:

```bash
# after changing/adding an entity
npm run migration:generate --name=YourMigrationName

# apply migrations to the database
npm run migration:run

# revert the most recent migration if needed
npm run typeorm -- migration:revert
```

Existing migrations (applied in order):

1. **`1782754062808-Init`** — creates the initial `sites` and `user` tables with the `ownerId` foreign key.
2. **`1782811217768-Init`** — follow-up schema adjustment.
3. **`1782936261675-migrations`** — adds a required `name` column to `users` (backfilled with `'Unknown'`) and converts `role` into a Postgres enum (`admin` | `agent`, default `agent`).

## API documentation

Once the app is running, interactive Swagger docs are available at:

```
http://localhost:3000/api
```

Swagger is configured with a Bearer auth scheme (`access-token`) — click **Authorize** and paste a JWT (obtained from `/auth/login`) to call protected endpoints directly from the UI.

### Auth module (`/auth`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Body: `{ email, password }`. Verifies credentials against the `users` table and returns `{ access_token, user: { id, email, role } }`. |

### Users module (`/users`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/users` | Public | Register a new user. Body: `{ name, email, password }`. Password is hashed with bcrypt; role defaults to `agent`. Fails with `409 Conflict` if the email is already taken. |
| GET | `/users` | Public | List all users (password excluded via `UserDto` mapping). |
| GET | `/users/:id` | Public | Get a single user by id. |
| PATCH | `/users/:id` | Public | Update `name`/`email`/`password`/`role`. Re-hashes the password if provided; rejects duplicate emails. |
| DELETE | `/users/:id` | Public | Delete a user by id. |

> Note: the User endpoints are not currently guarded by JWT/roles — see [Verification](#verification) for how to add coverage or lock these down further if required by the assignment rubric.

### Site module (`/site`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/site` | JWT + `admin` role | Body: `{ name, url }`. Creates a site owned by the authenticated user (`ownerId` taken from the JWT payload). Requires `Authorization: Bearer <token>` for a user with `role = admin`. |

Role enforcement is implemented via `RolesGuard` + `@Roles(Role.ADMIN)`, which reads the `role` claim set on the JWT payload during login (`JwtStrategy.validate`).

## Real-Time Verification

1. **Start the stack**
   ```bash
   docker compose up -d
   npm run migration:run
   npm run start:dev
   ```
2. **REST API (Swagger)**
   - Register a user via `POST http://localhost:3000/users` with `{ "name": "Admin", "email": "admin@example.com", "password": "password123" }`.
   - Log in via `POST http://localhost:3000/auth/login` to obtain an `access_token`.
   - Explore endpoints at `http://localhost:3000/api` using the Bearer token.
3. **WebSockets (Chat Gateway)**
   - Connect a Socket.io client to `ws://localhost:3000`.
   - **Agent Auth**: Connect with `{ auth: { token: "<jwt_token>" } }` to authenticate via `WsJwtGuard`.
   - **Visitor Auth**: Connect with `{ query: { conversationId: "<uuid>" } }`.
4. **WebSocket Events**
   - Emit `joinConversation`, `sendMessage`, `typing`, `pauseConversation` to interact in real-time.
   - Verify that `participantPresence` and `messageStatus` (delivered/read) are properly broadcasted between agents and visitors.
5. **Run automated tests**
   ```bash
   npm run test        # unit tests
   npm run test:e2e     # end-to-end tests
   ```

## License

UNLICENSED — for educational/assignment purposes.
