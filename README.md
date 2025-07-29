# 💬 Modern Chat Application

A full-featured real-time chat application built with React, Node.js, Socket.IO, and MongoDB Atlas. Features include real-time messaging, file sharing, user authentication, avatar uploads, and beautiful theming.

## ✨ Features

- 🔐 **User Authentication** - Secure JWT-based auth with MongoDB Atlas
- 💬 **Real-time Messaging** - Instant messaging with Socket.IO
- 📁 **File Sharing** - Drag-and-drop file uploads with download support
- 👤 **User Profiles** - Avatar uploads and profile customization
- 🎨 **Multiple Themes** - Light, Dark, and Solarized themes with custom scrollbars
- 😀 **Message Reactions** - React to messages with emojis
- ⌨️ **Typing Indicators** - See when others are typing
- 📱 **Responsive Design** - Works beautifully on all devices
- 🔄 **Smart Scroll** - Preserves scroll position during interactions
- 🔊 **Connection Status** - Visual indicators for connection state

## 🛠️ Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development
- **Socket.IO Client** for real-time communication
- **Tailwind CSS** for styling
- **Custom CSS** for enhanced theming

### Backend
- **Node.js** with Express
- **Socket.IO** for real-time features
- **MongoDB Atlas** for data persistence
- **JWT** for authentication
- **Multer** for file uploads
- **bcrypt** for password hashing

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- npm (comes with Node.js)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account
- VSCode with [Tailwind CSS IntelliSense Extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) (recommended)

## � Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/DevaOnL/Chat-app.git
cd Chat-app
```

### 2. Environment Setup

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env  # If you have an example file
```

Configure your `.env` file:

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/chatapp?retryWrites=true&w=majority

# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Environment
NODE_ENV=development

# Server Port
PORT=3000
```

### 3. Install Dependencies

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### 4. Start the Application

**Start Backend Server:**
```bash
cd backend
npm start
```
The backend will run on `http://localhost:3000`

**Start Frontend Development Server:**
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:5173`

## 🔧 Development

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd backend
npm run build
```

### Available Scripts

**Backend:**
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript

**Frontend:**
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📁 Project Structure

```
chat-app/
├── backend/
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── models/         # MongoDB models
│   │   ├── services/       # Business logic
│   │   ├── auth.ts         # Authentication routes
│   │   ├── middleware.ts   # Custom middleware
│   │   └── index.ts        # Main server file
│   ├── uploads/            # File upload storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── themes.ts       # Theme definitions
│   │   ├── app.css         # Global styles
│   │   └── App.tsx         # Main app component
│   └── package.json
└── README.md
```

## 🎨 Themes

The application supports three beautiful themes:

- **Light Theme** - Clean and modern light interface
- **Dark Theme** - Elegant dark mode with enhanced contrast
- **Solarized Theme** - Popular Solarized color scheme

Each theme includes custom scrollbar styling and consistent color schemes across all components.

## 🔐 Authentication

- JWT-based authentication
- Secure password hashing with bcrypt
- Protected routes and real-time connections
- User profile management

## 📱 File Sharing

- Drag-and-drop file uploads
- Support for images and various file types
- File size validation (5MB limit)
- Secure file download with proper headers
- Image preview with modal gallery

## 💡 Troubleshooting

**MongoDB Connection Issues:**
- Ensure your MongoDB Atlas cluster is running
- Check your connection string in `.env`
- Verify your IP address is whitelisted in Atlas

**Port Conflicts:**
- Make sure ports 3000 (backend) and 5173 (frontend) are available
- Kill any existing processes: `taskkill /F /PID <process-id>`

**Missing Dependencies:**
```bash
# If you encounter import errors
cd backend
npm install

cd frontend
npm install
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙋‍♂️ Support

If you have any questions or run into issues, please open an issue on GitHub or contact the maintainer.

---

Built with ❤️ by [DevaOnL](https://github.com/DevaOnL)
