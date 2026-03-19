interface Env {
  RESEND_API_KEY: string;
}

interface EventContext {
  request: Request;
  env: Env;
}

export async function onRequestPost(context: EventContext): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const formData = await context.request.formData();

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = (formData.get('phone') as string) || 'Not provided';
    const product = (formData.get('product') as string) || 'Not specified';
    const message = formData.get('message') as string;

    // Honeypot check
    const gotcha = formData.get('_gotcha') as string;
    if (gotcha) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tahin Spare Suppliers <onboarding@resend.dev>',
        to: ['tahinship@gmail.com'],
        subject: `New Enquiry from ${name} — ${product}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #c0392b; padding: 20px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">New Website Enquiry</h1>
            </div>
            <div style="padding: 25px; background: #f9f9f9;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee; width: 140px;">Name:</td>
                  <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Email:</td>
                  <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Phone:</td>
                  <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${phone}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Product:</td>
                  <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${product}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #333; vertical-align: top;">Message:</td>
                  <td style="padding: 10px; color: #555; white-space: pre-wrap;">${message}</td>
                </tr>
              </table>
            </div>
            <div style="padding: 15px; text-align: center; font-size: 12px; color: #999;">
              Sent from Tahin Spare Suppliers website
            </div>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errorData = await resendRes.text();
      console.error('Resend API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Enquiry sent successfully!' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Server error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
