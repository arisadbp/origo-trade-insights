import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { getDb } from "./db.js";
import { insertAuditLog } from "./audit.js";
import { authorize, requireRoleHeader } from "./rbac.js";
import { DATA_DIR } from "./config.js";
import { getSupabaseServerClient } from "./supabase.js";

function nowIso() {
  return new Date().toISOString();
}

function rowToJson(row, jsonFields) {
  if (!row) return null;
  const copy = { ...row };
  for (const field of jsonFields) {
    if (copy[field] && typeof copy[field] === "string") {
      copy[field] = JSON.parse(copy[field]);
    }
  }
  return copy;
}

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function getCustomerOrThrow(db, customerId) {
  const row = db.prepare("select * from customers where id = ?").get(customerId);
  if (!row) throw createError(404, "Customer not found");
  return row;
}

function getCustomerAccountOrThrow(db, customerId) {
  const row = db.prepare("select * from customer_accounts where customer_id = ?").get(customerId);
  if (!row) throw createError(404, "Customer account not found");
  return row;
}

async function resolveMarketCompanyId(db, customerId, supabase) {
  const linked = db.prepare("select company_id from customer_market_links where customer_id = ?").get(customerId);
  if (linked?.company_id) {
    return linked.company_id;
  }

  const customer = getCustomerOrThrow(db, customerId);
  const terms = [customer.company_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!terms.length) return null;

  for (const term of terms) {
    const { data, error } = await supabase
      .from("supabase_companies")
      .select("company_id, customer_name, customer")
      .or(`customer_name.ilike.%${term}%,customer.ilike.%${term}%`)
      .limit(1);

    if (error) continue;
    const first = data?.[0];
    if (!first?.company_id) continue;

    db.prepare(`
      insert into customer_market_links (customer_id, company_id, source, updated_at)
      values (?, ?, 'auto_match', datetime('now'))
      on conflict(customer_id) do update set
        company_id = excluded.company_id,
        source = excluded.source,
        updated_at = datetime('now')
    `).run(customerId, first.company_id);
    return first.company_id;
  }
  return null;
}

async function requireMarketContext(db, customerId) {
  getCustomerOrThrow(db, customerId);
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw createError(
      500,
      "Supabase server connection is missing. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_*).",
    );
  }

  const companyId = await resolveMarketCompanyId(db, customerId, supabase);
  if (!companyId) {
    throw createError(
      404,
      "No linked market company_id for this customer. Link it first in Backoffice Market tab.",
    );
  }

  return { supabase, companyId };
}

export function createApp() {
  const app = express();
  const db = getDb();
  const uploadDir = path.join(DATA_DIR, "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
        cb(null, safeName);
      },
    }),
  });

  app.use(cors());
  app.use(express.json());
  app.use(requireRoleHeader);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: nowIso() });
  });

  app.get("/api/admin/customer-context/search", authorize("customer.read"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const rows = db.prepare(`
      select
        c.id as customer_id,
        c.company_name,
        a.email,
        a.username,
        a.role
      from customers c
      join customer_accounts a on a.customer_id = c.id
      where lower(c.company_name) like @q
         or lower(a.email) like @q
         or lower(a.username) like @q
      order by c.company_name asc
      limit 20
    `).all({ q: `%${q}%` });
    res.json({ data: rows });
  });

  app.get("/api/admin/customers/:customerId", authorize("customer.read"), (req, res, next) => {
    try {
      const { customerId } = req.params;
      const customer = getCustomerOrThrow(db, customerId);
      const account = getCustomerAccountOrThrow(db, customerId);
      const uploadStats = db.prepare(`
        select
          count(*) as total_uploads,
          sum(case when review_status = 'PENDING' then 1 else 0 end) as pending_uploads,
          sum(case when review_status = 'APPROVED' then 1 else 0 end) as approved_uploads
        from uploads
        where customer_id = ? and deleted_at is null
      `).get(customerId);
      const recentActivity = db.prepare(`
        select id, action, target_type, reason, created_at, actor_email
        from audit_logs
        where target_id = ?
        order by id desc
        limit 12
      `).all(customerId);

      res.json({
        data: {
          customer,
          account,
          stats: uploadStats,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/profile", authorize("customer.write"), (req, res, next) => {
    const schema = z.object({
      company_name: z.string().min(1),
      contact_name: z.string().default(""),
      phone: z.string().default(""),
      country: z.string().default(""),
      notes: z.string().default(""),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const before = getCustomerOrThrow(db, customerId);
      db.prepare(`
        update customers
        set company_name = @company_name,
            contact_name = @contact_name,
            phone = @phone,
            country = @country,
            notes = @notes,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: customerId,
        ...input,
      });
      const after = getCustomerOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "customer.profile.update",
        targetType: "customer",
        targetId: customerId,
        beforeData: before,
        afterData: after,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/account/email", authorize("account.email_change"), (req, res, next) => {
    const schema = z.object({
      newEmail: z.string().email(),
      reason: z.string().min(3),
      forceSignOutAllSessions: z.boolean().optional().default(false),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const accountBefore = getCustomerAccountOrThrow(db, customerId);
      const emailInUse = db
        .prepare("select id from customer_accounts where lower(email) = lower(?) and id <> ?")
        .get(input.newEmail, accountBefore.id);
      if (emailInUse) {
        throw createError(409, "Email is already used by another customer account");
      }

      db.prepare(`
        update customer_accounts
        set email = @email,
            updated_at = datetime('now'),
            force_signout_at = case when @force_signout = 1 then datetime('now') else force_signout_at end
        where id = @id
      `).run({
        id: accountBefore.id,
        email: input.newEmail.toLowerCase(),
        force_signout: input.forceSignOutAllSessions ? 1 : 0,
      });

      if (input.forceSignOutAllSessions) {
        db.prepare(`
          update customer_sessions
          set revoked_at = datetime('now')
          where customer_account_id = ? and revoked_at is null
        `).run(accountBefore.id);
      }

      const accountAfter = getCustomerAccountOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.email.change",
        targetType: "customer_account",
        targetId: accountBefore.id,
        beforeData: accountBefore,
        afterData: accountAfter,
        reason: input.reason,
      });
      res.json({ data: accountAfter });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/account/reset-password", authorize("account.reset_password"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const account = getCustomerAccountOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.password.reset",
        targetType: "customer_account",
        targetId: account.id,
        beforeData: { email: account.email, username: account.username },
        afterData: { resetTriggeredAt: nowIso() },
        reason: input.reason,
      });
      res.json({
        data: {
          customer_account_id: account.id,
          reset_method: "email_link",
          status: "triggered",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/security/sessions", authorize("customer.read"), (req, res, next) => {
    try {
      const account = getCustomerAccountOrThrow(db, req.params.customerId);
      const sessions = db.prepare(`
        select id, device_label, ip_address, user_agent, last_seen_at, revoked_at, created_at
        from customer_sessions
        where customer_account_id = ?
        order by datetime(last_seen_at) desc
      `).all(account.id);
      res.json({ data: sessions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/security/sign-out-all", authorize("account.force_signout"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const account = getCustomerAccountOrThrow(db, req.params.customerId);
      const beforeCount = db
        .prepare("select count(*) as count from customer_sessions where customer_account_id = ? and revoked_at is null")
        .get(account.id);
      db.prepare(`
        update customer_sessions
        set revoked_at = datetime('now')
        where customer_account_id = ? and revoked_at is null
      `).run(account.id);
      db.prepare(`
        update customer_accounts
        set force_signout_at = datetime('now'), updated_at = datetime('now')
        where id = ?
      `).run(account.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.sessions.signout_all",
        targetType: "customer_account",
        targetId: account.id,
        beforeData: { activeSessions: beforeCount.count },
        afterData: { activeSessions: 0 },
        reason: input.reason,
      });
      res.json({ data: { revoked_sessions: beforeCount.count } });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/uploads", authorize("customer.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const includeDeleted = String(req.query.includeDeleted || "false") === "true";
      const rows = db.prepare(`
        select *
        from uploads
        where customer_id = @customerId
          and (@includeDeleted = 1 or deleted_at is null)
        order by datetime(created_at) desc
      `).all({
        customerId: req.params.customerId,
        includeDeleted: includeDeleted ? 1 : 0,
      });
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/admin/customers/:customerId/uploads",
    authorize("upload.manage"),
    upload.single("file"),
    (req, res, next) => {
    const schema = z.object({
      file_name: z.string().min(2).optional(),
      file_type: z.string().min(2).optional(),
      description: z.string().default(""),
      uploaded_by: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body ?? {});
      const customer = getCustomerOrThrow(db, req.params.customerId);
      const id = `upl-${Math.random().toString(36).slice(2, 10)}`;
      const fileName = req.file?.originalname || input.file_name;
      const fileType = req.file?.mimetype || input.file_type;
      if (!fileName || !fileType) {
        throw createError(400, "file_name and file_type are required when file is not uploaded");
      }
      db.prepare(`
        insert into uploads (
          id, customer_id, file_name, file_type, description, review_status, uploaded_by, storage_path
        ) values (
          @id, @customer_id, @file_name, @file_type, @description, 'PENDING', @uploaded_by, @storage_path
        )
      `).run({
        id,
        customer_id: customer.id,
        file_name: fileName,
        file_type: fileType,
        description: input.description,
        uploaded_by: input.uploaded_by,
        storage_path: req.file ? path.relative(process.cwd(), req.file.path) : null,
      });
      const created = db.prepare("select * from uploads where id = ?").get(id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.create",
        targetType: "upload",
        targetId: id,
        afterData: created,
      });
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
    },
  );

  app.patch("/api/admin/customers/:customerId/uploads/:uploadId", authorize("upload.manage"), (req, res, next) => {
    const schema = z.object({
      file_name: z.string().min(2).optional(),
      file_type: z.string().min(2).optional(),
      description: z.string().optional(),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");

      db.prepare(`
        update uploads
        set file_name = coalesce(@file_name, file_name),
            file_type = coalesce(@file_type, file_type),
            description = coalesce(@description, description),
            review_status = 'PENDING',
            reviewer_id = null,
            reviewer_name = null,
            reviewer_comment = null,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: before.id,
        file_name: input.file_name || null,
        file_type: input.file_type || null,
        description: input.description ?? null,
      });
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.reupload",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/customers/:customerId/uploads/:uploadId", authorize("upload.manage"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body || {});
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");
      db.prepare("update uploads set deleted_at = datetime('now') where id = ?").run(before.id);
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.delete",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/uploads/:uploadId/review", authorize("upload.review"), (req, res, next) => {
    const schema = z.object({
      review_status: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
      comment: z.string().default(""),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");
      db.prepare(`
        update uploads
        set review_status = @review_status,
            reviewer_id = @reviewer_id,
            reviewer_name = @reviewer_name,
            reviewer_comment = @reviewer_comment,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: before.id,
        review_status: input.review_status,
        reviewer_id: req.actor.id,
        reviewer_name: req.actor.email,
        reviewer_comment: input.comment,
      });
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.review",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/source-status", authorize("market.read"), async (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const linked = db.prepare("select customer_id, company_id, source, updated_at from customer_market_links where customer_id = ?").get(req.params.customerId);
      res.json({ data: linked || null });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/customers/:customerId/market-intelligence/link", authorize("market.read"), (req, res, next) => {
    const schema = z.object({
      companyId: z.string().min(1),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare("select * from customer_market_links where customer_id = ?").get(req.params.customerId);
      db.prepare(`
        insert into customer_market_links (customer_id, company_id, source, updated_at)
        values (?, ?, 'manual', datetime('now'))
        on conflict(customer_id) do update set
          company_id = excluded.company_id,
          source = excluded.source,
          updated_at = datetime('now')
      `).run(req.params.customerId, input.companyId.trim());
      const after = db.prepare("select * from customer_market_links where customer_id = ?").get(req.params.customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "market.link_company",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        afterData: after,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence", authorize("market.read"), async (req, res, next) => {
    try {
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const market = String(req.query.market || "").trim();
      const productType = String(req.query.productType || "").trim();
      const dateFrom = String(req.query.dateFrom || "").trim();
      const dateTo = String(req.query.dateTo || "").trim();

      let query = supabase
        .from("purchase_trend")
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .eq("company_id", companyId)
        .order("date", { ascending: true });

      if (market) query = query.eq("destination_country", market);
      if (productType) query = query.ilike("product", `%${productType}%`);
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query.limit(5000);
      if (error) throw createError(500, error.message);

      res.json({
        data: (data || []).map((row) => ({
          id: `pt-${row.id}`,
          source_record_id: row.id,
          customer_id: req.params.customerId,
          market: row.destination_country || "",
          product_type: row.product || "",
          metric_date: String(row.date || "").slice(0, 10),
          value: Number(row.weight_kg || 0),
          created_at: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/market-intelligence/records", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      market: z.string().min(1),
      product_type: z.string().min(1),
      metric_date: z.string().min(8),
      value: z.number().finite().nonnegative(),
      reason: z.string().min(3).default("Manual update from admin"),
    });
    try {
      const input = schema.parse(req.body);
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);

      const payload = {
        company_id: companyId,
        date: input.metric_date,
        destination_country: input.market,
        product: input.product_type,
        hs_code: "170199",
        weight_kg: input.value,
        quantity: input.value,
        total_price_usd: 0,
      };

      const { data, error } = await supabase
        .from("purchase_trend")
        .insert(payload)
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .single();
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.create",
        targetType: "customer",
        targetId: req.params.customerId,
        afterData: data,
        reason: input.reason,
      });

      res.status(201).json({
        data: {
          id: `pt-${data.id}`,
          source_record_id: data.id,
          customer_id: req.params.customerId,
          market: data.destination_country || "",
          product_type: data.product || "",
          metric_date: String(data.date || "").slice(0, 10),
          value: Number(data.weight_kg || 0),
          created_at: data.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/market-intelligence/records/:recordId", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      market: z.string().min(1),
      product_type: z.string().min(1),
      metric_date: z.string().min(8),
      value: z.number().finite().nonnegative(),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const recordId = Number(req.params.recordId);
      if (!Number.isFinite(recordId)) throw createError(400, "Invalid record id");

      const { data: before, error: beforeError } = await supabase
        .from("purchase_trend")
        .select("*")
        .eq("id", recordId)
        .eq("company_id", companyId)
        .single();
      if (beforeError || !before) throw createError(404, "Market record not found");

      const { data, error } = await supabase
        .from("purchase_trend")
        .update({
          destination_country: input.market,
          product: input.product_type,
          date: input.metric_date,
          weight_kg: input.value,
          quantity: input.value,
        })
        .eq("id", recordId)
        .eq("company_id", companyId)
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .single();
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.update",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        afterData: data,
        reason: input.reason,
      });

      res.json({
        data: {
          id: `pt-${data.id}`,
          source_record_id: data.id,
          customer_id: req.params.customerId,
          market: data.destination_country || "",
          product_type: data.product || "",
          metric_date: String(data.date || "").slice(0, 10),
          value: Number(data.weight_kg || 0),
          created_at: data.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/customers/:customerId/market-intelligence/records/:recordId", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body || {});
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const recordId = Number(req.params.recordId);
      if (!Number.isFinite(recordId)) throw createError(400, "Invalid record id");

      const { data: before, error: beforeError } = await supabase
        .from("purchase_trend")
        .select("*")
        .eq("id", recordId)
        .eq("company_id", companyId)
        .single();
      if (beforeError || !before) throw createError(404, "Market record not found");

      const { error } = await supabase
        .from("purchase_trend")
        .delete()
        .eq("id", recordId)
        .eq("company_id", companyId);
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.delete",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        reason: input.reason,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/export.csv", authorize("market.export"), async (req, res, next) => {
    try {
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const { data, error } = await supabase
        .from("purchase_trend")
        .select("destination_country, product, date, weight_kg")
        .eq("company_id", companyId)
        .order("date", { ascending: true })
        .limit(5000);
      if (error) throw createError(500, error.message);
      const header = "market,product_type,metric_date,value";
      const csvRows = (data || []).map((row) => `${row.destination_country || ""},${row.product || ""},${String(row.date || "").slice(0, 10)},${Number(row.weight_kg || 0)}`);
      const csv = `${header}\n${csvRows.join("\n")}`;
      res.setHeader("content-type", "text/csv");
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/export.pdf", authorize("market.export"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      res.setHeader("content-type", "application/pdf");
      res.send(Buffer.from("%PDF-1.1\n% ORIGO market intelligence export placeholder\n", "utf8"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/presets", authorize("market.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, customer_id, name, filters_json, created_by, created_at
        from market_intelligence_presets
        where customer_id = ?
        order by datetime(created_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows.map((row) => rowToJson(row, ["filters_json"])) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/market-intelligence/presets", authorize("preset.manage"), (req, res, next) => {
    const schema = z.object({
      name: z.string().min(2),
      filters: z.object({
        market: z.string().optional(),
        productType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const id = `preset-${Math.random().toString(36).slice(2, 10)}`;
      db.prepare(`
        insert into market_intelligence_presets (id, customer_id, name, filters_json, created_by)
        values (@id, @customer_id, @name, @filters_json, @created_by)
      `).run({
        id,
        customer_id: req.params.customerId,
        name: input.name,
        filters_json: JSON.stringify(input.filters),
        created_by: req.actor.id,
      });
      const created = db.prepare("select * from market_intelligence_presets where id = ?").get(id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "market.preset.create",
        targetType: "market_preset",
        targetId: id,
        afterData: rowToJson(created, ["filters_json"]),
      });
      res.status(201).json({ data: rowToJson(created, ["filters_json"]) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/inventory", authorize("inventory.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, sku, product_name, qty, unit, updated_at
        from inventory_items
        where customer_id = ?
        order by datetime(updated_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/invoices", authorize("invoice.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, invoice_no, amount, currency, status, due_date, created_at
        from invoices
        where customer_id = ?
        order by datetime(created_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/audit-logs", authorize("audit.read"), (req, res) => {
    const targetId = String(req.query.targetId || "").trim();
    const rows = db.prepare(`
      select *
      from audit_logs
      where (? = '' or target_id = ?)
      order by id desc
      limit 100
    `).all(targetId, targetId);
    res.json({ data: rows.map((row) => rowToJson(row, ["before_json", "after_json"])) });
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 400;
    res.status(status).json({
      error: "request_failed",
      message: error.message || "Request failed",
    });
  });

  return app;
}
