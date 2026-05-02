export async function sendSMS({ to, message }) {
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SENDER_ID || 'SwiftImport';

  if (!clientId || !clientSecret) {
    console.warn('⚠️  Hubtel credentials not configured — SMS not sent');
    return { success: false, reason: 'not_configured' };
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://smsc.hubtel.com/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
      body: JSON.stringify({ From: senderId, To: to, Content: message }),
    });

    const data = await response.json();
    if (!response.ok) return { success: false, reason: data.message || 'Hubtel SMS error' };
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function sendWhatsApp({ to, message }) {
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SENDER_ID || 'SwiftImport';

  if (!clientId || !clientSecret) {
    console.warn('⚠️  Hubtel credentials not configured — WhatsApp not sent');
    return { success: false, reason: 'not_configured' };
  }

  try {
    const normalised = to.startsWith('0') ? '233' + to.slice(1) : to;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.hubtel.com/v1/whatsapp/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
      body: JSON.stringify({ from: senderId, to: normalised, content: message }),
    });

    const data = await response.json();
    if (!response.ok) return { success: false, reason: data.message || 'Hubtel WhatsApp error' };
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}