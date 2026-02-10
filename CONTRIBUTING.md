# Contributing Guide

เอกสารนี้กำหนดวิธีทำงานร่วมกันของทีมในโปรเจกต์นี้เพื่อให้แก้เว็บพร้อมกันได้ปลอดภัยและลด conflict

## 1) Branch Strategy

- `main`: โค้ดพร้อมใช้งานและ deploy ได้
- สร้าง branch ใหม่จาก `main` ทุกครั้ง
- ตั้งชื่อ branch ตามประเภทงาน:
  - `feat/<short-name>` สำหรับฟีเจอร์ใหม่
  - `fix/<short-name>` สำหรับแก้บั๊ก
  - `chore/<short-name>` สำหรับงานปรับปรุงทั่วไป
  - `docs/<short-name>` สำหรับงานเอกสาร

ตัวอย่าง:
- `feat/dashboard-filter`
- `fix/login-redirect`

## 2) Commit Convention

ใช้รูปแบบ commit message แบบสั้นและสื่อความหมาย:

- `feat: add export button in analytics page`
- `fix: prevent crash when uploaded file is empty`
- `docs: add team review checklist`
- `chore: update dependencies`

## 3) Local Development

```bash
npm i
npm run dev
```

ก่อน push ให้ตรวจคุณภาพ:

```bash
npm run lint
npm run test
npm run build
```

## 4) Pull Request Flow

1. อัปเดต `main` ล่าสุด
2. สร้าง branch งาน
3. ทำงานและ commit ให้เป็นชุดเล็กที่ review ง่าย
4. push branch และเปิด Pull Request
5. ให้ทีม review อย่างน้อย 1 คนก่อน merge
6. แก้ตาม feedback แล้วค่อย merge

ใช้ template ที่ไฟล์ `.github/pull_request_template.md` และตรวจตาม checklist ใน `docs/review-checklist.md`

## 5) Merge Rules (แนะนำ)

- ห้าม push ตรง `main`
- บังคับ merge ผ่าน Pull Request เท่านั้น
- เปิด branch protection บน `main`:
  - Require pull request before merging
  - Require at least 1 approval
  - Require status checks to pass (`CI / quality-check`)

## 6) Conflict ลดได้ด้วยวิธีนี้

- ดึง `main` ล่าสุดก่อนเริ่มงานและก่อนเปิด PR
- อย่าทำหลายเรื่องใน PR เดียว
- คุย scope งานใน issue/PR description ให้ชัดเจน
