const axios = require('axios');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const STAGE_MAP = {
  'New Lead': 'new_lead',
  'Qualified': 'qualified',
  'Unqualified': 'unqualified',
  'Won': 'won',
  'Spam': 'spam',
  'Current Customer': 'current_customer'
};

async function syncGHLLeads() {
  console.log('Starting GHL sync for Atlas...');

  try {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('ghl_location_id', GHL_LOCATION_ID)
      .single();

    if (!account) {
      console.error('Account not found for location:', GHL_LOCATION_ID);
      return;
    }

    const response = await axios.get(
      `https://services.leadconnectorhq.com/contacts/`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28'
        },
        params: {
          locationId: GHL_LOCATION_ID,
          limit: 100
        }
      }
    );

    const contacts = response.data.contacts || [];
    console.log(`Fetched ${contacts.length} contacts from GHL`);

    for (const contact of contacts) {
      const leadType = contact.type === 'phone' ? 'call' : 'form';
      const source = contact.source || 'organic';
      const stage = STAGE_MAP[contact.pipelineStage] || 'new_lead';

      const leadData = {
        account_id: account.id,
        ghl_contact_id: contact.id,
        lead_date: contact.dateAdded
          ? new Date(contact.dateAdded).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        lead_type: leadType,
        source: source,
        pipeline_stage: stage,
        is_qualified: ['qualified', 'won', 'current_customer'].includes(stage),
        is_closed: stage === 'won',
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('leads')
        .upsert(leadData, { onConflict: 'account_id,ghl_contact_id' });
    }

    await supabase.from('sync_log').insert({
      account_id: account.id,
      sync_type: 'ghl_lead
