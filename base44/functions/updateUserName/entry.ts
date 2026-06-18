import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = (body.full_name || '').trim();
    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

    await base44.asServiceRole.entities.User.update(user.id, { full_name: name });

    return Response.json({ success: true, full_name: name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});