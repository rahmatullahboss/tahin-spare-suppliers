interface EventContext {
  request: Request;
}

/**
 * Legacy Cloudflare Pages Function.
 *
 * The active enquiry endpoint is the Astro route at src/pages/api/enquiry.ts.
 * This stub prevents an accidental Pages deployment from restoring the retired
 * raw Resend implementation with a test-domain sender.
 */
export async function onRequestPost(_context: EventContext): Promise<Response> {
  return Response.json(
    {
      error: "Legacy enquiry endpoint is disabled. Deploy the Astro Worker application.",
    },
    { status: 410 }
  );
}
