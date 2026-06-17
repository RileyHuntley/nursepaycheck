import { createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token) {
      try {
        const body = await req.json();
        token = body.token;
      } catch (_) { /* body not JSON or already consumed */ }
    }
    if (!token) {
      return Response.json({ error: 'Missing share token' }, { status: 400 });
    }

    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
    });

    // Use service role to bypass RLS and read settings by share_token
    const allSettings = await base44.asServiceRole.entities.Settings.list();
    console.log('Settings found:', allSettings.length, allSettings.map(s => s.share_token));
    const settings = allSettings.find(s => s.share_token === token);
    if (!settings) {
      return Response.json({ error: 'Invalid or expired share link', tokens: allSettings.map(s => s.share_token) }, { status: 404 });
    }

    const userId = settings.created_by_id;

    const payPeriods = await base44.asServiceRole.entities.PayPeriod.filter(
      { created_by_id: userId },
      '-start_date',
      50
    );

    // Strip sensitive fields
    const safeSettings = {
      hourly_wage: settings.hourly_wage,
      premium_rates: settings.premium_rates,
      ot_multipliers: settings.ot_multipliers,
      active_allowances: settings.active_allowances,
      allowance_rates: settings.allowance_rates,
      active_qualifications: settings.active_qualifications,
      qualification_rates: settings.qualification_rates,
      hospitals: settings.hospitals,
      units: settings.units,
      preset_times: settings.preset_times,
      tax_settings: settings.tax_settings,
    };

    return Response.json({
      settings: safeSettings,
      payPeriods: payPeriods.filter(p => p.shifts && p.shifts.length > 0),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});