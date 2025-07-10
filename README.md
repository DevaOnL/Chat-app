# Chat App Setup Guide

This guide will walk you through installing dependencies and running the chat application (frontend and backend) with Tailwind CSS.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- npm (comes with Node.js)
- VSCode with Tailwind CSS IntelliSense Extension (optional but recommended)

---

## 🔧 Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/DevaOnL/Chat-app.git
cd Chat-app
```

⸻

2. Install Root Dependencies
```bash
npm install
```
This installs any shared tools or scripts in the root folder.

⸻

3. Set Up Tailwind in Frontend

Navigate to the frontend directory:
```bash
cd frontend
```
Install Tailwind and required PostCSS tools:
```bash
npm install -D tailwindcss postcss autoprefixer
```

Build the frontend:
```bash
npm run build
```

⸻

4. Run the Backend

Navigate to the backend folder:
Install backend dependencies (if not already done):
```bash
cd ../backend
npm install
```
Start the backend server:
```bash
npm run dev
```

⸻

💡 Troubleshooting

If you see import-related errors (e.g., uuid not found), you may need to install missing packages inside the appropriate folder. Example:
```bash
cd frontend
npm install uuid
```

⸻

✅ Summary
	•	Install dependencies in both frontend/ and backend/.
	•	Tailwind CSS setup is needed in frontend/.
	•	Run npm run build in frontend/, then npm run dev in backend/.

⸻

✨ Optional

Use the Tailwind CSS IntelliSense extension in VSCode for better dev experience.
