# 📱 ARTS - Audit Recommendation Tracking System

**Project:** Audit Recommendation Tracking System for Rwanda Revenue Authority (RRA).
**Stack:** React Native (Expo), TypeScript, Supabase (PostgreSQL).

---

## 📖 1. Understand the Project

This project was designed to meet the specific needs of the RRA Internal Audit Department. Its goal is to replace Excel files with a centralized mobile application to track audit recommendations.

### Workflow:
1.  **The Auditor** creates a recommendation (detected issue) and assigns it to a department.
2.  **The Focal Person** (department head) sees the task, assigns it to their staff, and uploads **evidence** (files/photos) once the issue is resolved.
3.  **The Auditor** verifies the evidence. They can validate (Green ✅) or reject the evidence.
4.  **The Director** validates the final status of the recommendation.

### Status Color Code:
* ✅ **Green:** Fully Implemented
* 🟡 **Yellow:** Partially Implemented
* 🔴 **Red:** Not Implemented
* 🟣 **Purple:** Beyond Management Control
* 🔵 **Blue:** Not Applicable

---

## 🛠 2. Prerequisites (What to install on your PC)

Before starting, make sure you have installed these software on your computer:

1.  **Node.js (LTS)**: Download it from [nodejs.org](https://nodejs.org/). This is the engine that runs the code.
2.  **Git**: To download the project from GitHub.
3.  **VS Code**: The recommended code editor.
4.  **"Expo Go" App** on your phone (Android or iPhone) to test the application live.

---

## ☁️ 3. Database Setup (Supabase)

The application cannot work without its "brain" (the Backend). We use **Supabase**.

### Step A: Create the project
1.  Go to [supabase.com](https://supabase.com) and click on **"Start your project"**.
2.  Create an account (or log in with GitHub).
3.  Click on **"New Project"**.
4.  Give a name (e.g., `RRA-ARTS`) and create a strong password for the database.
5.  Choose a nearby region (e.g., Europe or Africa if available).
6.  Click on **"Create new project"** and wait a few minutes for it to load.

### Step B: Get Connection Keys (API Keys)
Once the project is created:
1.  In the left menu, click on the **Settings** gear icon.
2.  Click on **API**.
3.  You will see two crucial pieces of information:
    * **Project URL** (e.g., `https://xyz.supabase.co`)
    * **anon public key** (a very long string of characters).
    * ⚠️ *Keep this page open, we will need it in Step 5.*

### Step C: Create Tables and Data (SQL Script)
1.  In the left Supabase menu, click on the **SQL Editor** icon.
2.  In your project folder (on your computer), open the file `db_setup_full.sql` (provided with the code).
3.  Copy **ALL** the code inside.
4.  Paste it into the Supabase SQL Editor.
5.  Click the green **RUN** button (bottom right).
    * *Success: It will display "Success. No rows returned". Your tables (Audits, Users, Departments) are now created and filled with dummy data!*

---

## 💻 4. Code Installation on Your Computer

### Step A: Clone and Install
Open your terminal (or command prompt) and type:

```bash
# 1. Download the code (Replace with your repo link)
git clone <GITHUB_PROJECT_LINK>

# 2. Enter the folder
cd project-folder-name

# 3. Install libraries (Dependencies)
npm install
```

*This will install all necessary dependencies like `expo`, `@supabase/supabase-js`, `lucide-react-native`, etc.*

---

## 🔑 5. Connect Code to Supabase (Crucial Step)

The application needs to know which Supabase project to connect to retrieve data.

1. Look at the root of the project folder (where `package.json` is located).
2. Create a **new file** named exactly: `.env`
* *(Note: it is `.env`, not `env.txt`)*

3. Open this `.env` file with your code editor.
4. Paste the following content, replacing the values with yours (retrieved in Step 3B):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-url-here.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-very-long-public-key-here
```

⚠️ **Important:** Do not put spaces around the `=` sign. Save the file properly.

---

## 🚀 6. Run and Test the Application

### Step A: Start the server

In your terminal, run the following command:

```bash
npx expo start --clear
```

A **QR Code** will appear in the terminal.

* **On your phone:** Open the **Expo Go** app and scan the QR code (Android) or use the camera (iPhone).
* **On PC:** Press `a` key to launch an Android emulator or `i` for iOS (if configured).

### Step B: Login (Create Access)

The SQL script created audit data, but it did not create a login account for you because passwords are private.

1. On the app login screen, click the **"Sign Up"** link.
2. Create an account with an email (e.g., `admin@rra.rw`) and a password (e.g., `123456`).
3. Once logged in, **the Dashboard will show "0"**. This is normal! Your new user does not have a defined role yet.

### Step C: Become an Administrator (Auditor)

To see the data and test the application with full rights (Auditor), you must manually modify your role.

1. Go back to your **Supabase** project in the browser.
2. Click on **SQL Editor** in the left menu.
3. Clear the old code and paste this (replace the email with yours):

```sql
UPDATE profiles
SET role = 'auditor', 
    department_id = 5 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@rra.rw');
```

4. Click **RUN**.
5. **On your phone:** Refresh the application (pull down to refresh or reload).
6. 🎉 **Congratulations! You should see the colored charts and the list of recommendations.**

---

## 🆘 Useful Commands

* `npx expo start`: Start the app normally.
* `npx expo start -c`: Start while clearing the cache (use if the app crashes or doesn't update).
* `git pull`: Get the latest code updates from GitHub.

**Developed with ❤️ for RRA**
