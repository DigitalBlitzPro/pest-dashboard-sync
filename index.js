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
      'https://services.leadconnectorhq.com/contacts/',
      {
        headers: {
          Authorization: 'Bearer ' + GHL_API_KEY,
          Version: '2021-07-28'
        },
        params: {
          locationId: GHL_LOCATION_ID,
          limit: 100
        }
      }
    );

    const contacts = response.data.contacts || [];
    console.log('Fetched ' + contacts.length + ' contacts from GHL');

    for (const contact of contacts) {
  let leadType = 'form';
  try {
    const contactDetail = await axios.get(
      'https://services.leadconnectorhq.com/contacts/' + contact.id,
      {
        headers: {
          Authorization: 'Bearer ' + GHL_API_KEY,
          Version: '2021-07-28'
        }
      }
    );
    const createdBy = contactDetail.data.contact?.createdBy;
    leadType = (createdBy && createdBy.source === 'lc-phone-api') ? 'call' : 'form';
  } catch (e) {
    console.error('Could not fetch detail for contact:', contact.id);
  }
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
      sync_type: 'ghl_leads',
      status: 'success',
      message: 'Synced ' + contacts.length + ' contacts'
    });

    console.log('GHL sync complete.');

  } catch (err) {
    console.error('GHL sync error:', err.message);
    await supabase.from('sync_log').insert({
      sync_type: 'ghl_leads',
      status: 'error',
      message: err.message
    });
  }
}
async function syncPipelineStages() {
  console.log('Syncing pipeline stages...');
  try {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('ghl_location_id', GHL_LOCATION_ID)
      .single();

    // First fetch the pipeline to get stage ID → name mapping
    const pipelineResponse = await axios.get(
      'https://services.leadconnectorhq.com/opportunities/pipelines',
      {
        headers: {
          Authorization: 'Bearer ' + GHL_API_KEY,
          Version: '2021-07-28'
        },
        params: {
          locationId: GHL_LOCATION_ID
        }
      }
    );

    // Build stageId → our stage key map
    const stageIdMap = {};
    const pipelines = pipelineResponse.data.pipelines || [];
    for (const pipeline of pipelines) {
      for (const stage of (pipeline.stages || [])) {
        console.log('Pipeline stage found:', stage.id, '→', stage.name);
        stageIdMap[stage.id] = STAGE_MAP[stage.name] || 'new_lead';
      }
    }

    // Now fetch opportunities
    const response = await axios.get(
      'https://services.leadconnectorhq.com/opportunities/search',
      {
        headers: {
          Authorization: 'Bearer ' + GHL_API_KEY,
          Version: '2021-07-28'
        },
        params: {
          location_id: GHL_LOCATION_ID,
          limit: 100
        }
      }
    );

    const opportunities = response.data.opportunities || [];
    console.log('Fetched ' + opportunities.length + ' opportunities from GHL');

    for (const opp of opportunities) {
      let stage;
      if (opp.status === 'won') {
        stage = 'won';
      } else if (opp.status === 'lost') {
        stage = 'unqualified';
      } else {
        stage = stageIdMap[opp.pipelineStageId] || 'new_lead';
      }

      await supabase
        .from('leads')
        .update({
          pipeline_stage: stage,
          is_qualified: ['qualified', 'won', 'current_customer'].includes(stage),
          is_closed: stage === 'won',
          ghl_opportunity_id: opp.id
        })
        .eq('account_id', account.id)
        .eq('ghl_contact_id', opp.contactId);
    }

    console.log('Pipeline stage sync complete.');
  } catch (err) {
    console.error('Pipeline sync error:', err.message);
  }
}
syncGHLLeads().then(() => syncPipelineStages());

cron.schedule('0 6 * * *', () => syncGHLLeads().then(() => syncPipelineStages()));
