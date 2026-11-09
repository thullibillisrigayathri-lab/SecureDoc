# AI Usage and Development Notes - SecureDoc

This file records AI assistance, development issues, corrections, and verification performed during the SecureDoc project.

## AI Assistance

AI assistance was used to help with:
- Understanding Express.js routes and middleware.
- Implementing authentication and session handling.
- Understanding role-based document permissions.
- Debugging API route errors.
- Improving Git and project documentation.
- Planning security tests.

## Issues Encountered and Corrections

### 1. Git repository initialized in the wrong directory
- Issue: Git was initially initialized from the user home directory.
- Correction: Repository commands were run from the SecureDoc project folder.

### 2. Missing backend database module
- Issue: The server could not load the database module.
- Correction: The database module was created and its import path was corrected.

### 3. Authentication route errors
- Issue: Authentication API requests returned route errors.
- Correction: Server route mounting and the running server process were checked and corrected.

### 4. Document route errors
- Issue: Document API requests returned "Cannot GET" responses.
- Correction: The documents router mounting and server process were checked.

### 5. Unauthorized document access
- Issue: An employee without the required permission attempted to read a document.
- Correction: Server-side permission checks denied the request with HTTP 403.

### 6. Session-related errors
- Issue: Protected endpoints returned HTTP 401 when no valid login session was supplied.
- Correction: Login sessions were used when testing protected endpoints.

### 7. Git command not recognized
- Issue: PowerShell could not locate Git.
- Correction: The installed Git command directory was temporarily added to the current PowerShell PATH.

## Verification Performed

The following local checks were performed:
- Admin login.
- Employee login.
- Admin document access.
- Employee access denial without permission.
- Permission restoration.
- Document listing.
- Audit log entries for allowed and denied actions.

## Development Notes

- AI-generated code was reviewed and tested during development.
- Errors were investigated using terminal output and API responses.
- Do not claim a feature is complete unless it has been tested.
- Live deployment and production testing must be recorded separately from local testing.
