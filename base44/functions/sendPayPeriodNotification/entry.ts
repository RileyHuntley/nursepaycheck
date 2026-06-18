import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { test_mode } = payload;

    const settingsList = await base44.entities.Settings.filter({});
    const settings = settingsList.length > 0 ? settingsList[0] : null;
    if (!settings) return Response.json({ sent: false, reason: 'No settings found' }, { status: 200 });

    if (!settings.notification_enabled && !test_mode) {
      return Response.json({ sent: false, reason: 'Notifications disabled' }, { status: 200 });
    }

    const email = settings.notification_email;
    if (!email) return Response.json({ sent: false, reason: 'No notification email configured' }, { status: 200 });

    const periods = await base44.asServiceRole.entities.PayPeriod.filter({});
    if (periods.length === 0) return Response.json({ sent: false, reason: 'No pay periods' }, { status: 200 });

    const today = new Date().toISOString().slice(0, 10);

    let targetPeriod = null;
    if (test_mode) {
      targetPeriod = periods.find(p =>
        p.end_date &&
        p.shifts &&
        p.shifts.length > 0 &&
        !p.verification_notified_at
      );
    } else {
      targetPeriod = periods.find(p =>
        p.end_date &&
        p.end_date <= today &&
        p.shifts &&
        p.shifts.length > 0 &&
        !p.verification_notified_at
      );
    }

    if (!targetPeriod) {
      return Response.json({
        sent: false,
        reason: test_mode
          ? 'No unnotified period with shifts to test'
          : 'No recently ended unnotified period with shifts'
      }, { status: 200 });
    }

    const pendingCount = targetPeriod.shifts.filter(s =>
      s.status !== 'verified' && s.status !== 'upcoming'
    ).length;

    const periodName = targetPeriod.name || `${targetPeriod.start_date} – ${targetPeriod.end_date}`;
    const shiftCount = targetPeriod.shifts.length;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `Pay Period Ready for Verification – ${periodName}`,
      body: [
        `Hi ${user.full_name || 'there'},`,
        '',
        `Your pay period **${periodName}** has ended and is ready for verification.`,
        '',
        `• ${shiftCount} shift${shiftCount !== 1 ? 's' : ''} logged`,
        `• ${pendingCount} shift${pendingCount !== 1 ? 's' : ''} pending verification`,
        '',
        `Log in to NursePayCheck to review your shifts and compare against your pay stub when it arrives.`,
        '',
        `– NursePayCheck`,
      ].join('\n'),
    });

    await base44.asServiceRole.entities.PayPeriod.update(targetPeriod.id, {
      verification_notified_at: today,
    });

    return Response.json({ sent: true, period: targetPeriod.id, pendingCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});