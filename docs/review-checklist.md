# Review Checklist

ใช้ checklist นี้ก่อนอนุมัติ Pull Request

## Functionality

- [ ] ทำงานได้ตาม requirement
- [ ] ไม่มี regression ใน flow หลัก
- [ ] มีการ handle กรณี error ที่คาดการณ์ได้

## Code Quality

- [ ] โค้ดอ่านง่ายและตั้งชื่อสื่อความหมาย
- [ ] ไม่มี logic ซ้ำซ้อนที่ควร extract
- [ ] ไม่มี dead code หรือ debug log ที่ไม่จำเป็น

## Security & Data

- [ ] ไม่มี hardcoded secret/token
- [ ] validation input เพียงพอ
- [ ] ไม่เปิดเผยข้อมูลสำคัญใน UI/API log

## UI/UX (ถ้ามีการเปลี่ยนหน้าเว็บ)

- [ ] Layout ไม่แตกบน desktop/mobile
- [ ] สถานะ loading/empty/error ชัดเจน
- [ ] ข้อความ/label เข้าใจง่าย

## Testing & Verification

- [ ] Reviewer ทดลองตามขั้นตอนใน PR แล้ว
- [ ] `lint`, `test`, `build` ผ่าน
- [ ] อัปเดตเอกสารหรือ note ที่เกี่ยวข้องแล้ว
