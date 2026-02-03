const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getLicenseKey(request) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return request.headers.get('x-license-key') || '';
}

async function parseJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return {};
  }
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

async function verifyStripeSignature(request, secret) {
  const signature = request.headers.get('stripe-signature') || '';
  const payload = await request.text();

  const parts = signature.split(',').map((part) => part.trim());
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return { valid: false, payload: null };
  }

  const timestamp = timestampPart.split('=')[1];
  const signatureValue = signaturePart.split('=')[1];
  if (!timestamp || !signatureValue) {
    return { valid: false, payload: null };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected !== signatureValue) {
    return { valid: false, payload: null };
  }

  try {
    return { valid: true, payload: JSON.parse(payload) };
  } catch (_) {
    return { valid: false, payload: null };
  }
}

function planFromPriceId(priceId, env) {
  if (!priceId) {
    return { plan: 'none', site_limit: 0 };
  }

  const map = {
    [env.STRIPE_PRICE_SEATS_BASIC || '']: { plan: 'basic', site_limit: 1 },
    [env.STRIPE_PRICE_SEATS_PRO || '']: { plan: 'pro', site_limit: 5 }
  };

  return map[priceId] || { plan: 'custom', site_limit: 1 };
}

function siteLimitFromQuantity(quantity) {
  const qty = Number.isFinite(quantity) ? quantity : parseInt(quantity || '0', 10);
  return qty > 0 ? qty : 1;
}

async function validateLicense(licenseKey, siteUrl, env) {
  if (!licenseKey) {
    return {
      valid: false,
      plan: 'none',
      features: {},
      expires_at: null,
      ttl: 300,
      site_limit: 0,
      current_sites_used: 0
    };
  }

  const raw = await env.LICENSES.get(`license:${licenseKey}`);
  if (!raw) {
    return {
      valid: false,
      plan: 'none',
      features: {},
      expires_at: null,
      ttl: 300,
      site_limit: 0,
      current_sites_used: 0
    };
  }

  const data = JSON.parse(raw);
  return {
    valid: data.status === 'active',
    plan: data.plan || 'basic',
    features: data.features || {},
    expires_at: data.expires_at || null,
    ttl: data.ttl || 900,
    site_limit: data.site_limit || 1,
    current_sites_used: data.current_sites_used || 0,
    stripe_customer_id: data.stripe_customer_id || null,
    stripe_subscription_id: data.stripe_subscription_id || null
  };
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'stripe_webhook_secret_missing' }, 500);
  }

  const { valid, payload } = await verifyStripeSignature(request, env.STRIPE_WEBHOOK_SECRET);
  if (!valid || !payload) {
    return jsonResponse({ error: 'invalid_signature' }, 400);
  }

  const eventId = payload.id;
  if (eventId) {
    const existing = await env.EVENTS.get(`stripe_event:${eventId}`);
    if (existing) {
      return jsonResponse({ status: 'ignored', reason: 'duplicate' });
    }
  }

  const eventType = payload.type || '';
  const dataObject = payload.data && payload.data.object ? payload.data.object : {};

  if (eventType === 'checkout.session.completed') {
    const licenseKey = dataObject.client_reference_id || '';
    const customerId = dataObject.customer || '';
    const subscriptionId = dataObject.subscription || '';

    if (licenseKey && customerId && subscriptionId) {
      const current = await env.LICENSES.get(`license:${licenseKey}`);
      const record = current ? JSON.parse(current) : {};

      await env.LICENSES.put(`sub:${subscriptionId}`, licenseKey);
      await env.LICENSES.put(`customer:${customerId}`, licenseKey);

      record.stripe_customer_id = customerId;
      record.stripe_subscription_id = subscriptionId;
      record.status = 'active';
      record.plan = record.plan || 'basic';
      record.features = record.features || {
        album_selection: true,
        integrations: { nextgen: true, envira: true, foogallery: true },
        sources: ['immich']
      };
      record.site_limit = record.site_limit || 1;
      record.current_sites_used = record.current_sites_used || 0;

      await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record));
    }
  }

  if (
    eventType === 'customer.subscription.created' ||
    eventType === 'customer.subscription.updated' ||
    eventType === 'customer.subscription.deleted'
  ) {
    const subscriptionId = dataObject.id || '';
    const customerId = dataObject.customer || '';
    const status = dataObject.status || 'inactive';
    const items = dataObject.items && dataObject.items.data ? dataObject.items.data : [];
    const primaryItem = items[0] || {};
    const priceId = primaryItem.price && primaryItem.price.id ? primaryItem.price.id : '';
    const quantity = primaryItem.quantity || 1;

    const pricing = planFromPriceId(priceId, env);
    const siteLimit = siteLimitFromQuantity(quantity);

    // Reverse lookup license by subscription
    let licenseKey = await env.LICENSES.get(`sub:${subscriptionId}`);
    if (!licenseKey && customerId) {
      licenseKey = await env.LICENSES.get(`customer:${customerId}`);
    }
    if (licenseKey) {
      const existing = await env.LICENSES.get(`license:${licenseKey}`);
      const record = existing ? JSON.parse(existing) : {};

      record.status = status === 'active' ? 'active' : 'inactive';
      record.plan = pricing.plan;
      record.site_limit = siteLimit;
      record.stripe_customer_id = customerId;
      record.stripe_subscription_id = subscriptionId;
      record.features = record.features || {
        album_selection: true,
        integrations: { nextgen: true, envira: true, foogallery: true },
        sources: ['immich']
      };

      await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record));
    }
  }

  if (eventType === 'invoice.paid' || eventType === 'invoice.payment_failed') {
    const subscriptionId = dataObject.subscription || '';
    const licenseKey = await env.LICENSES.get(`sub:${subscriptionId}`);
    if (licenseKey) {
      const existing = await env.LICENSES.get(`license:${licenseKey}`);
      if (existing) {
        const record = JSON.parse(existing);
        record.status = eventType === 'invoice.paid' ? 'active' : 'inactive';
        await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record));
      }
    }
  }

  if (eventId) {
    await env.EVENTS.put(`stripe_event:${eventId}`, '1', { expirationTtl: 60 * 60 * 24 });
  }

  return jsonResponse({ status: 'ok' });
}

async function activateLicense(licenseKey, siteUrl, installId, env) {
  const entitlements = await validateLicense(licenseKey, siteUrl, env);
  if (!entitlements.valid) {
    return { ok: false, status: 403, error: 'license_invalid' };
  }

  const recordRaw = await env.LICENSES.get(`license:${licenseKey}`);
  const record = recordRaw ? JSON.parse(recordRaw) : {};
  const sites = Array.isArray(record.sites) ? record.sites : [];

  const existing = sites.find((site) => site.install_id === installId || site.site_url === siteUrl);
  if (!existing && sites.length >= entitlements.site_limit) {
    return { ok: false, status: 403, error: 'site_limit_exceeded' };
  }

  const updatedSites = existing
    ? sites.map((site) => site.install_id === installId || site.site_url === siteUrl
        ? { install_id: installId, site_url: siteUrl, activated_at: Date.now() }
        : site)
    : sites.concat([{ install_id: installId, site_url: siteUrl, activated_at: Date.now() }]);

  record.sites = updatedSites;
  record.current_sites_used = updatedSites.length;

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record));

  return { ok: true, status: 200, data: { current_sites_used: record.current_sites_used, site_limit: entitlements.site_limit } };
}

async function deactivateLicense(licenseKey, siteUrl, installId, env) {
  const recordRaw = await env.LICENSES.get(`license:${licenseKey}`);
  if (!recordRaw) {
    return { ok: false, status: 404, error: 'license_not_found' };
  }

  const record = JSON.parse(recordRaw);
  const sites = Array.isArray(record.sites) ? record.sites : [];
  const filtered = sites.filter((site) => site.install_id !== installId && site.site_url !== siteUrl);

  record.sites = filtered;
  record.current_sites_used = filtered.length;

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record));

  return { ok: true, status: 200, data: { current_sites_used: record.current_sites_used } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/v1/webhooks/stripe' && method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    if (path === '/v1/features' && method === 'GET') {
      const licenseKey = getLicenseKey(request);
      const siteUrl = request.headers.get('x-site-url') || '';
      const entitlements = await validateLicense(licenseKey, siteUrl, env);
      return jsonResponse(entitlements);
    }

    if (path === '/v1/license/verify' && method === 'POST') {
      const body = await parseJson(request);
      const licenseKey = (body.license_key || '').toString().trim();
      const siteUrl = (body.site_url || '').toString().trim();
      const entitlements = await validateLicense(licenseKey, siteUrl, env);
      return jsonResponse(entitlements);
    }

    if (path === '/v1/license/activate' && method === 'POST') {
      const body = await parseJson(request);
      const licenseKey = (body.license_key || '').toString().trim();
      const siteUrl = (body.site_url || '').toString().trim();
      const installId = (body.install_id || '').toString().trim();

      const result = await activateLicense(licenseKey, siteUrl, installId, env);
      return jsonResponse(result.ok ? result.data : { error: result.error }, result.status);
    }

    if (path === '/v1/license/deactivate' && method === 'POST') {
      const body = await parseJson(request);
      const licenseKey = (body.license_key || '').toString().trim();
      const siteUrl = (body.site_url || '').toString().trim();
      const installId = (body.install_id || '').toString().trim();

      const result = await deactivateLicense(licenseKey, siteUrl, installId, env);
      return jsonResponse(result.ok ? result.data : { error: result.error }, result.status);
    }

    if (path.startsWith('/v1/integrations/') && method === 'POST') {
      const licenseKey = getLicenseKey(request);
      const siteUrl = request.headers.get('x-site-url') || '';
      const entitlements = await validateLicense(licenseKey, siteUrl, env);
      if (!entitlements.valid) {
        return jsonResponse({ error: 'license_required' }, 403);
      }
      const name = path.split('/').pop();
      return jsonResponse({ status: 'accepted', integration: name });
    }

    if (path === '/v1/connection/test' && method === 'GET') {
      const licenseKey = getLicenseKey(request);
      const entitlements = await validateLicense(licenseKey, request.headers.get('x-site-url') || '', env);
      if (!entitlements.valid) {
        return jsonResponse({ status: 'error', message: 'License required.' }, 403);
      }
      return jsonResponse({ status: 'success' });
    }

    if (path === '/v1/albums' && method === 'GET') {
      const licenseKey = getLicenseKey(request);
      const entitlements = await validateLicense(licenseKey, request.headers.get('x-site-url') || '', env);
      if (!entitlements.valid) {
        return jsonResponse({ error: 'license_required' }, 403);
      }
      return jsonResponse([]);
    }

    if (path === '/v1/sync/start' && method === 'POST') {
      const licenseKey = getLicenseKey(request);
      const entitlements = await validateLicense(licenseKey, request.headers.get('x-site-url') || '', env);
      if (!entitlements.valid) {
        return jsonResponse({ error: 'license_required' }, 403);
      }
      return jsonResponse({ status: 'sync_started', albums: 0, assets: 0 });
    }

    if (path === '/v1/sync/status' && method === 'GET') {
      return jsonResponse({ running: false, progress_exists: false });
    }

    if (path === '/v1/sync/progress' && method === 'GET') {
      return jsonResponse({});
    }

    if (path === '/v1/sync/cancel' && method === 'POST') {
      return jsonResponse({ status: 'cancelled' });
    }

    if (path === '/v1/sync/skip-asset' && method === 'POST') {
      const body = await parseJson(request);
      return jsonResponse({ status: 'skipped', asset_id: body.asset_id || '' });
    }

    if (path === '/v1/sync/reset' && method === 'POST') {
      return jsonResponse({ status: 'reset_complete' });
    }

    if (path === '/v1/sync/complete' && method === 'POST') {
      return jsonResponse({ status: 'cleared' });
    }

    return jsonResponse({ error: 'not_found' }, 404);
  }
};
