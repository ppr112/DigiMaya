const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function logEvent(eventType, payload = {}, severity = 'info') {
  try {
    await supabase
      .from('digimaya_events')
      .insert({
        tenant_id: payload.tenantId || null,
        customer_id: payload.customerId || null,
        event_type: eventType,
        severity,
        payload
      })
  } catch (err) {
    // Never let logging break the main flow
    console.error('logEvent failed:', err.message)
  }
}

module.exports = { logEvent }