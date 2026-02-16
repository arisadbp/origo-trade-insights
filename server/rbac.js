export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ORIGO_MANAGER",
  "REVIEWER",
  "BILLING",
  "SUPPORT",
];

const PERMISSIONS = {
  SUPER_ADMIN: [
    "customer.read",
    "customer.write",
    "account.email_change",
    "account.reset_password",
    "account.force_signout",
    "upload.manage",
    "upload.review",
    "market.read",
    "market.export",
    "preset.manage",
    "inventory.read",
    "invoice.read",
    "audit.read",
  ],
  ORIGO_MANAGER: [
    "customer.read",
    "customer.write",
    "account.email_change",
    "account.reset_password",
    "account.force_signout",
    "upload.manage",
    "upload.review",
    "market.read",
    "market.export",
    "preset.manage",
    "inventory.read",
    "invoice.read",
    "audit.read",
  ],
  REVIEWER: [
    "customer.read",
    "upload.review",
    "market.read",
    "market.export",
    "inventory.read",
    "invoice.read",
  ],
  BILLING: [
    "customer.read",
    "invoice.read",
    "audit.read",
  ],
  SUPPORT: [
    "customer.read",
    "account.reset_password",
    "account.force_signout",
    "upload.manage",
    "market.read",
    "inventory.read",
    "invoice.read",
    "audit.read",
  ],
};

export function hasPermission(role, permission) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function requireRoleHeader(req, _res, next) {
  const role = String(req.header("x-admin-role") || "SUPER_ADMIN").trim().toUpperCase();
  const email = String(req.header("x-admin-email") || "super.admin@origo.local").trim().toLowerCase();
  const id = String(req.header("x-admin-id") || "admin-super").trim();
  const ipAddress = req.header("x-forwarded-for") || req.ip || "";
  const userAgent = req.header("user-agent") || "";

  req.actor = {
    id,
    email,
    role,
    ipAddress,
    userAgent,
  };
  next();
}

export function authorize(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.actor.role, permission)) {
      res.status(403).json({
        error: "forbidden",
        message: `Role ${req.actor.role} is missing permission ${permission}`,
      });
      return;
    }
    next();
  };
}
