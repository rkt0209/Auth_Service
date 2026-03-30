# Auth Service

Handles all user identity operations for the Airline Booking system: registration, login, JWT token generation and validation, and role-based access checks. Every protected action in the system traces back to this service.

---

## Architecture Overview

```
API Gateway
  |-- POST /authservice/api/v1/signup        --> Create new user
  |-- POST /authservice/api/v1/signin        --> Login, receive JWT
  |-- GET  /authservice/api/v1/isauthenticated --> Validate JWT (called by gateway)
  |-- GET  /authservice/api/v1/users/:id     --> Get user by ID (called by BookingService)
  |-- GET  /authservice/api/v1/isAdmin       --> Check admin role

AuthService
  |
  v
MySQL Database (AUTH_DB_DEV)
  |-- Users table
  |-- Roles table
  |-- User_Roles junction table
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js + Express 5.2.1 | Server runtime and framework |
| Sequelize 6.37.7 | ORM for MySQL |
| mysql2 3.16.0 | MySQL driver |
| jsonwebtoken 9.0.3 | JWT signing and verification |
| bcrypt 6.0.0 | Password hashing |
| axios 1.13.2 | HTTP client (for inter-service calls if needed) |
| body-parser 2.2.1 | Request body parsing |
| http-status-codes 2.3.0 | Consistent HTTP status codes |
| dotenv 17.2.3 | Environment variable loading |
| nodemon 3.1.11 | Auto-restart in development |

---

## Database Design

**Database:** `AUTH_DB_DEV`

### Users Table

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | Primary Key, Auto Increment |
| email | STRING | Unique, Required, Valid email format |
| password | STRING | Required, Length 3–100, Hashed at rest |
| role | STRING | Default: `'Passenger'` |
| createdAt | DATE | Auto-managed by Sequelize |
| updatedAt | DATE | Auto-managed by Sequelize |

### Roles Table

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | Primary Key, Auto Increment |
| name | STRING | Required |
| createdAt | DATE | Auto-managed |
| updatedAt | DATE | Auto-managed |

Pre-seeded roles: `ADMIN`, `Passenger`

### User_Roles Table (Junction)

| Column | Type |
|---|---|
| userId | INTEGER (FK → Users) |
| roleId | INTEGER (FK → Roles) |

### Relationships
- `User` belongsToMany `Role` (through `User_Roles`)
- `Role` belongsToMany `User` (through `User_Roles`)

---

## API Endpoints

### `POST /authservice/api/v1/signup`

Registers a new user.

**Middleware:** `AuthValidate` — verifies `email` and `password` are present in body.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "role": "Passenger"
}
```

**Flow:**
1. `AuthValidate` middleware checks email + password exist → 400 if missing.
2. UserService calls UserRepository to create a new User record.
3. Sequelize `beforeCreate` hook fires automatically → password is hashed with bcrypt (salt rounds: 10) before the record is written.
4. Created user is returned.

**Response (201):**
```json
{
  "success": true,
  "message": "Successfully created a new user",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "Passenger"
  }
}
```

**Error Responses:**
- `400` — Missing email or password
- `400` — Validation error (invalid email format, short password)
- `500` — Internal server error

---

### `POST /authservice/api/v1/signin`

Authenticates a user and returns a JWT.

**Middleware:** `AuthValidate` — verifies `email` and `password` are present.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Flow:**
1. `AuthValidate` middleware checks email + password exist.
2. UserRepository fetches user by email.
3. `bcrypt.compare()` checks the provided password against the stored hash.
4. If password is wrong → 401 Unauthorized.
5. If a `role` was sent in the body, checks if the user has that role via `User.hasRole()` → 403 Forbidden if role mismatch.
6. JWT is generated with payload `{ email, id, role }`, signed with `JWT_KEY`, expires in `1 day`.
7. JWT token is returned.

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged in",
  "data": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` — Missing email or password
- `401` — Wrong password
- `403` — Role mismatch
- `500` — Internal error

---

### `GET /authservice/api/v1/isAuthenticated`

Validates a JWT token. Called by the API Gateway middleware before forwarding booking requests.

**Request Header:**
```
x-access-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Flow:**
1. Reads `x-access-token` from request headers.
2. `jwt.verify()` decodes the token using `JWT_KEY`.
3. If token is invalid or expired → 401.
4. Fetches the user from DB using the decoded `id`.
5. If user not found → 401.
6. Returns the user's ID as confirmation.

**Response (200):**
```json
{
  "success": true,
  "data": 1
}
```

**Error Responses:**
- `401` — Missing, invalid, or expired token
- `500` — Internal error

---

### `GET /authservice/api/v1/users/:id`

Fetches a user by ID. Called by BookingService to get the user's email for notifications.

**URL Params:**
- `id` — numeric user ID

**Flow:**
1. UserRepository calls `findByPk(id)`.
2. Returns the user record (id and email only — no password).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- `404` — User not found
- `500` — Internal error

---

### `GET /authservice/api/v1/isAdmin`

Checks whether a user holds the ADMIN role.

**Middleware:** `validateIsAdminRequest` — verifies `userId` is present in request body.

**Request Body:**
```json
{
  "userId": 1
}
```

**Flow:**
1. Middleware checks `userId` exists → 400 if missing.
2. Fetches user with associated roles using Sequelize eager loading.
3. Fetches the Role record where `name = 'ADMIN'`.
4. Calls `user.hasRole(adminRole)` to check the junction table.
5. Returns boolean result.

**Response (200):**
```json
{
  "success": true,
  "data": true
}
```

**Error Responses:**
- `400` — Missing userId
- `500` — Internal error

---

## Middleware

### `AuthValidate`
Runs before signup and signin routes.
- Checks `req.body.email` is present → 400 if missing
- Checks `req.body.password` is present → 400 if missing

### `validateIsAdminRequest`
Runs before the isAdmin route.
- Checks `req.body.userId` is present → 400 if missing

---

## Password Hashing

Uses `bcrypt` with auto-generated salt (10 rounds).

**On signup:** Sequelize `beforeCreate` hook fires automatically before inserting any User record. The hook replaces the plain-text password with `bcrypt.hashSync(password, salt)`. The plain-text password is never stored.

**On signin:** `bcrypt.compare(plainTextPassword, hashedPassword)` is used. Returns `true` only if they match.

---

## JWT Token

| Property | Value |
|---|---|
| Algorithm | HS256 (HMAC SHA-256) |
| Secret | `process.env.JWT_KEY` |
| Expiry | 1 day |
| Payload | `{ email, id, role }` |

The token is returned as a raw string. Clients must include it in all booking requests via the `x-access-token` header.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port the service listens on (e.g., 7000) |
| `JWT_KEY` | Yes | Secret key for signing JWTs — keep this private |
| `DB_SYNC` | No | If set, Sequelize syncs models to DB on startup |

**.env example:**
```
PORT=7000
JWT_KEY=your_super_secret_key_here
```

---

## Database Setup

```bash
# Install dependencies
npm install

# Create the database
cd src
npx sequelize db:create

# Run migrations
npx sequelize db:migrate

# Seed roles (ADMIN, Passenger)
npx sequelize db:seed:all
```

**Database config** is in `src/config/config.json`:
```json
{
  "development": {
    "username": "YOUR_DB_USER",
    "password": "YOUR_DB_PASSWORD",
    "database": "AUTH_DB_DEV",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

---

## Running the Service

```bash
# Development
npx nodemon index.js

# Production
node index.js
```

Service starts on `PORT` (default: 7000).

---

## Project Structure

```
AuthService/
├── index.js                    # Express app setup, route registration
├── package.json
├── src/
│   ├── config/
│   │   └── config.json         # Sequelize DB connection config
│   ├── controllers/
│   │   └── user-controller.js  # Route handlers — calls service layer
│   ├── middlewares/
│   │   └── auth-request-validators.js  # AuthValidate, validateIsAdminRequest
│   ├── migrations/             # Sequelize migration files
│   ├── models/
│   │   ├── index.js            # Sequelize model loader
│   │   ├── user.js             # User model + beforeCreate hook
│   │   ├── role.js             # Role model
│   │   └── user-roles.js       # Junction table model
│   ├── repositories/
│   │   └── user-repository.js  # DB queries for User model
│   ├── routes/
│   │   └── v1/
│   │       └── index.js        # Route definitions
│   ├── seeders/                # Seed files for initial roles
│   ├── services/
│   │   └── user-service.js     # Business logic — orchestrates repository calls
│   └── utils/
│       ├── errors/             # Custom error classes (AppErrors, ClientError)
│       └── helper.js           # Utility functions
```

---

## Error Handling

Custom error classes:
- `AppErrors` — base class with message + statusCode
- `ClientError` — for 4xx errors caused by invalid input
- `ValidationError` — wraps Sequelize validation errors

All errors are caught in a central error handler in `index.js` and returned as:
```json
{
  "success": false,
  "message": "Error description",
  "data": {}
}
```

---

## Inter-Service Communication

| Called by | Endpoint | Why |
|---|---|---|
| API Gateway | GET /isauthenticated | Validate JWT before forwarding booking requests |
| BookingService | GET /users/:id | Get user email for confirmation/reminder emails |
