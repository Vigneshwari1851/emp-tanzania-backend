# Employee Management Platform Backend

A production-grade monolithic backend API system built with Node.js, TypeScript, Express, and Prisma.

## Tech Stack
- **Node.js** & **TypeScript**
- **Express.js** (Web framework)
- **Prisma ORM** (Database access)
- **MySQL** (Database)
- **JWT** (Authentication)
- **Nodemailer** (Email/OTP service)
- **Zod** (Request validation)

## 🚀 How to Run the App

### 1. Prerequisites
- Node.js (v16+)
- MySQL Server installed and running

### 2. Database Setup
1. Create a MySQL database named `emp_db` (or any name you prefer).
2. Update the `DATABASE_URL` in the `.env` file:
   ```env
   DATABASE_URL="mysql://YOUR_USER:YOUR_PASSWORD@localhost:3306/emp_db"
   ```

### 3. Installation
```bash
npm install
```

### 4. Prisma Setup
Generate Prisma client and run migrations (this will create the tables in your MySQL DB):
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Running the App
**Development Mode (with hot-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```
---

## 🛠 Project Structure
- `src/config`: Configuration & environment variables.
- `src/controller`: Request handlers.
- `src/service`: Business logic.
- `src/middlewares`: Auth, RBAC, Validation, Error Handling.
- `src/routes`: API route definitions.
- `src/utils`: Utilities (JWT, OTP, Email, Response Formatting).
- `prisma`: Database schema.
