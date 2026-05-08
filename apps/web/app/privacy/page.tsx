import { InfoPageShell } from '@/components/legal/info-page-shell';

export default function PrivacyPolicyPage() {
  return (
    <InfoPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      description="This lightweight page explains the current Community Edition posture while fuller legal documentation is still being prepared."
    >
      <p>
        DioTest Community Edition is intended for developer-controlled and self-hosted style workflows. Most runtime
        state is stored locally or in your own configured infrastructure.
      </p>
      <p>
        Project credentials such as provider tokens, webhook secrets, and API keys are stored only where the current
        product flow requires them. Sensitive values should still be treated as production secrets and rotated if
        exposed.
      </p>
      <p>
        This page is a temporary product-facing placeholder. Use the setup and concepts docs for current operational
        guidance until a full legal policy is published.
      </p>
    </InfoPageShell>
  );
}
