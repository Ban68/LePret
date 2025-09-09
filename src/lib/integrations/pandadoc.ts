// PandaDoc integration placeholder
// Replace stubs with real API calls using PandaDoc SDK or REST API.

export type PandaDocCreateDocInput = {
  name: string;
  recipients: { email: string; firstName?: string; lastName?: string; role?: string }[];
  fileUrl?: string;
  templateId?: string;
  variables?: Record<string, string | number>;
};

export async function createSignatureEnvelope(input: PandaDocCreateDocInput) {
  // In MVP, we will wire this to PandaDoc REST API with an API key
  // using env PANDADOC_API_KEY and PANDADOC_BASE_URL.
  // Here we return a mocked response.
  return {
    provider: "PANDADOC",
    envelopeId: "pd-demo-envelope-1",
    status: "created",
    signUrl: "https://app.pandadoc.com/s/demo-sign-url",
    input,
  };
}

