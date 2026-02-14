# Welcome to your Lovable project

## Team Workflow (GitHub)

สำหรับการทำงานร่วมกันในทีม ให้ใช้ Pull Request flow ตามเอกสารนี้:

- คู่มือทีม: `CONTRIBUTING.md`
- Checklist รีวิว: `docs/review-checklist.md`
- PR template: `.github/pull_request_template.md`
- CI checks: `.github/workflows/ci.yml`

Quick start:

```sh
# สร้าง branch ใหม่จาก main
git checkout main
git pull origin main
git checkout -b feat/your-task

# ทำงาน -> commit -> push
git add .
git commit -m "feat: short summary"
git push -u origin feat/your-task
```

จากนั้นเปิด Pull Request และให้ทีม review ก่อน merge

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Supabase setup

ระบบหลังบ้านสามารถเชื่อมกับ Supabase ได้โดยตรงแล้ว (fallback เป็น local cache หากยังไม่ตั้งค่า env)

1. สร้างโปรเจกต์ใน Supabase และคัดลอก:
   - `Project URL`
   - `anon public key`
2. คัดลอกไฟล์ `.env.example` เป็น `.env.local` แล้วตั้งค่า:

```sh
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

3. ไปที่ Supabase SQL Editor แล้วรันสคริปต์:
   - `docs/supabase-schema.sql`
4. ติดตั้ง dependency และรันแอป:

```sh
npm i
npm run dev
```

หมายเหตุ:
- หาก Supabase ว่าง ระบบจะ seed ข้อมูล demo เริ่มต้นให้อัตโนมัติ
- ตารางที่ใช้: `customers`, `admin_users`, `uploads`, `activity_logs`

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
