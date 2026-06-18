import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const targetUserId = body.userId;
    if (!targetUserId) return Response.json({ error: 'userId is required' }, { status: 400 });

    const [settings, periods, targetUser] = await Promise.all([
      base44.asServiceRole.entities.Settings.filter({ created_by_id: targetUserId }),
      base44.asServiceRole.entities.PayPeriod.filter({ created_by_id: targetUserId }, '-start_date', 100),
      base44.asServiceRole.entities.User.filter({ id: targetUserId }),
    ]);

    return Response.json({
      user: targetUser[0] ? { id: targetUser[0].id, email: targetUser[0].email, full_name: targetUser[0].full_name, display_name: targetUser[0].display_name, role: targetUser[0].role } : null,
      settings: settings[0] || null,
      periods,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});