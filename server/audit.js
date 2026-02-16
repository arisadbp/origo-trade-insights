export function insertAuditLog(db, payload) {
  const stmt = db.prepare(`
    insert into audit_logs (
      actor_id,
      actor_email,
      actor_role,
      action,
      target_type,
      target_id,
      before_json,
      after_json,
      reason,
      ip_address,
      user_agent
    )
    values (
      @actor_id,
      @actor_email,
      @actor_role,
      @action,
      @target_type,
      @target_id,
      @before_json,
      @after_json,
      @reason,
      @ip_address,
      @user_agent
    )
  `);

  stmt.run({
    actor_id: payload.actor.id,
    actor_email: payload.actor.email,
    actor_role: payload.actor.role,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId,
    before_json: payload.beforeData ? JSON.stringify(payload.beforeData) : null,
    after_json: payload.afterData ? JSON.stringify(payload.afterData) : null,
    reason: payload.reason || null,
    ip_address: payload.actor.ipAddress || null,
    user_agent: payload.actor.userAgent || null,
  });
}
