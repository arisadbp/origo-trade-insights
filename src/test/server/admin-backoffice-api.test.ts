/** @vitest-environment node */
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(process.cwd(), "server", "data", "origo-backoffice.test.db");

async function createTestApp() {
  process.env.ORIGO_DB_PATH = testDbPath;
  vi.resetModules();
  const { resetDbForTests } = await import("../../../server/db.js");
  resetDbForTests();
  const { createApp } = await import("../../../server/app.js");
  return createApp();
}

describe("admin backoffice api", () => {
  afterEach(async () => {
    const { resetDbForTests } = await import("../../../server/db.js");
    resetDbForTests();
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { force: true });
    }
  });

  it("changes customer email with force sign-out and writes audit log", async () => {
    const app = await createTestApp();
    const patch = await request(app)
      .patch("/api/admin/customers/cust-trrgroup/account/email")
      .set("x-admin-role", "SUPER_ADMIN")
      .send({
        newEmail: "new.info@farihealth.com",
        reason: "Customer requested legal email update",
        forceSignOutAllSessions: true,
      });

    expect(patch.status).toBe(200);
    expect(patch.body.data.email).toBe("new.info@farihealth.com");

    const sessions = await request(app)
      .get("/api/admin/customers/cust-trrgroup/security/sessions")
      .set("x-admin-role", "SUPER_ADMIN");

    expect(sessions.status).toBe(200);
    expect(sessions.body.data.every((row: { revoked_at: string | null }) => row.revoked_at)).toBe(true);

    const audit = await request(app)
      .get("/api/admin/audit-logs?targetId=acct-trrgroup")
      .set("x-admin-role", "SUPER_ADMIN");

    expect(audit.status).toBe(200);
    expect(audit.body.data.some((row: { action: string }) => row.action === "account.email.change")).toBe(true);
  });

  it("enforces RBAC for sensitive account email change", async () => {
    const app = await createTestApp();
    const patch = await request(app)
      .patch("/api/admin/customers/cust-trrgroup/account/email")
      .set("x-admin-role", "REVIEWER")
      .send({
        newEmail: "blocked@farihealth.com",
        reason: "Not allowed",
        forceSignOutAllSessions: false,
      });

    expect(patch.status).toBe(403);
  });

  it("creates audit log on profile update", async () => {
    const app = await createTestApp();
    const update = await request(app)
      .patch("/api/admin/customers/cust-trrgroup/profile")
      .set("x-admin-role", "ORIGO_MANAGER")
      .send({
        company_name: "THAI ROONG RUANG INDUSTRY CO., LTD.",
        contact_name: "New Contact",
        phone: "081-111-2222",
        country: "TH",
        notes: "Updated by manager",
      });

    expect(update.status).toBe(200);
    expect(update.body.data.contact_name).toBe("New Contact");

    const audit = await request(app)
      .get("/api/admin/audit-logs?targetId=cust-trrgroup")
      .set("x-admin-role", "SUPER_ADMIN");

    expect(audit.status).toBe(200);
    expect(audit.body.data.some((row: { action: string }) => row.action === "customer.profile.update")).toBe(true);
  });

  it("supports upload review flow from pending to approved with reviewer/comment", async () => {
    const app = await createTestApp();
    const create = await request(app)
      .post("/api/admin/customers/cust-trrgroup/uploads")
      .set("x-admin-role", "ORIGO_MANAGER")
      .send({
        file_name: "new-file.csv",
        file_type: "csv",
        description: "New monthly upload",
        uploaded_by: "info@farihealth.com",
      });

    expect(create.status).toBe(201);
    expect(create.body.data.review_status).toBe("PENDING");

    const review = await request(app)
      .patch(`/api/admin/customers/cust-trrgroup/uploads/${create.body.data.id}/review`)
      .set("x-admin-role", "REVIEWER")
      .set("x-admin-email", "reviewer@origo.local")
      .set("x-admin-id", "admin-reviewer")
      .send({
        review_status: "APPROVED",
        comment: "Validated and approved",
        reason: "Quality checks passed",
      });

    expect(review.status).toBe(200);
    expect(review.body.data.review_status).toBe("APPROVED");
    expect(review.body.data.reviewer_name).toBe("reviewer@origo.local");
    expect(review.body.data.reviewer_comment).toBe("Validated and approved");
  });
});
