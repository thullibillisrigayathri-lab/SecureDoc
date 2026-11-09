# SecureDoc

SecureDoc is a role-based document access management system designed to protect confidential PDF documents.

## Features

- User registration and login
- Password hashing using bcryptjs
- Admin and employee roles
- Admin approval for new users
- PDF document upload
- Document read and download permissions
- Server-side authorization checks
- Audit logs recording access decisions
- SQLite database for application records
- Session-based authentication

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: SQLite using better-sqlite3
- Authentication: express-session and bcryptjs
- File uploads: Multer

## Installation

1. Install Node.js.
2. Clone or download this repository.
3. Open the project folder in a terminal.
4. Install dependencies:

   npm install

5. Start the server:

   npm start

6. Open your browser:

   http://localhost:3000

## Security

- Passwords are hashed before storage.
- Document permissions are checked on the server.
- Unapproved accounts cannot access protected resources.
- Unauthorized document requests are denied.
- Document access decisions are recorded in audit logs.
- Private uploaded documents are stored separately from public frontend files.

## Important

- Do not commit database files, uploaded documents, passwords, or session secrets.
- Configure environment-specific settings before deployment.
- Use HTTPS and secure cookie settings in production.

## Project Status

Core authentication, document management, permission checks, and audit logging have been implemented and locally tested. Deployment and final production testing are pending.
