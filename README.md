# Smart Campus Complaint Management System

The Smart Campus Complaint Management System is a web-based application that enables students, faculty, and staff to register, track, and resolve campus-related complaints. It provides real-time status updates, admin dashboards, secure access, and efficient complaint management using Node.js and Express.

## Features
- User authentication (student, faculty, admin)
- Submit and manage complaints
- File uploads for complaints
- Notifications and email generation

## Quick Start
1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment variables as needed (if any).

3. Start the app:

   ```bash
   npm start
   ```

4. Open a browser at `http://localhost:3000` (default port).

## Project Structure
- `server.js` — app entry
- `routes/` — route handlers (`auth.js`, `complaints.js`, `users.js`)
- `models/` — Mongoose models (`User`, `Complaint`, `Notification`)
- `public/` — static frontend files
- `middleware/` — authentication and upload middleware
- `utils/` — helper modules (email/notifications)

## Contributing
Open an issue or send a PR. For major changes, please open an issue first.

## License
MIT
