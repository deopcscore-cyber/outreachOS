const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (email, password) => req('POST', '/auth/register', { email, password }),

  // Settings
  getSettings: () => req('GET', '/settings'),
  saveSettings: (data) => req('POST', '/settings', data),

  // Prospects
  searchProspects: (params) => req('POST', '/prospects/search', params),
  getProspects: () => req('GET', '/prospects'),
  saveProspect: (data) => req('POST', '/prospects', data),
  addToCampaign: (id, campaign_id) => req('POST', `/prospects/${id}/add-to-campaign`, { campaign_id }),
  regenerateEmail: (id, campaign_id) => req('POST', `/prospects/${id}/regenerate-email`, { campaign_id }),
  updateNotes: (id, notes) => req('PATCH', `/prospects/${id}/notes`, { notes }),

  // Campaigns
  getCampaigns: () => req('GET', '/campaigns'),
  getOutbox: () => req('GET', '/campaigns/outbox'),
  createCampaign: (name) => req('POST', '/campaigns', { name }),
  getCampaign: (id) => req('GET', `/campaigns/${id}`),
  updateCampaign: (id, data) => req('PATCH', `/campaigns/${id}`, data),
  deleteCampaign: (id) => req('DELETE', `/campaigns/${id}`),
  saveFollowups: (id, followups) => req('POST', `/campaigns/${id}/followups`, { followups }),
  updateAiEmail: (campaignId, prospectId, data) => req('PATCH', `/campaigns/${campaignId}/ai-email/${prospectId}`, data),
  updateLeadStatus: (campaignId, prospectId, lead_status) =>
    req('PATCH', `/campaigns/${campaignId}/prospects/${prospectId}/status`, { lead_status }),
  removeProspect: (campaignId, prospectId) => req('DELETE', `/campaigns/${campaignId}/prospects/${prospectId}`),

  // Analytics
  getAnalytics: () => req('GET', '/analytics'),
  getDashboard: () => req('GET', '/analytics/dashboard'),
  getWarmLeads: () => req('GET', '/analytics/warm-leads'),

  // Suppression
  getSuppressionList: () => req('GET', '/unsubscribe'),
  addToSuppression: (email, reason) => req('POST', '/unsubscribe', { email, reason }),
  removeFromSuppression: (id) => req('DELETE', `/unsubscribe/${id}`),
};
