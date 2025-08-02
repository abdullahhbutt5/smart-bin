# Smart-Bin
A web application to monitor waste bin fill levels and optimize collection routes.

## Setup
1. Install dependencies:
npm install

2. Start the server:
npm start

3. Add these
PORT = 3000
MONGODB_URI=mongodb+srv://lca:***********************/bin
JWT_SECRET=your_super_secret
GOOGLE_CLIENT_SECRET=GOCSPX-bQ-5MLOFKyYJDsTHOyg*******
SESSION_SECRET=smartbin********
GOOGLE_CLIENT_ID=62183318830-onscvtlp2rfvgsqa74ob*********i.apps.googleusercontent.com
AI_SERVICE_URL=http://localhost:5001


4. Features
Real-time bin monitoring
Fill level predictions
Admin and worker dashboards
Collection route optimization

5. Default Logins
   Admin:
   Username: admin
   Password: 123
   
   Workers:
   Username: worker1 to worker10
   Password: 123


Project Structure
text
smart-bin/
├── models/       # Database models
├── public/       # Static files
├── routes/       # API routes
├── views/        # EJS templates
├── app.js        # Main application
└── .env          # Environment variables
