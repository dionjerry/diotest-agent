import { InfoPageShell } from '@/components/legal/info-page-shell';

export default function TermsOfServicePage() {
  return (
    <InfoPageShell
      eyebrow="Terms"
      title="Terms of Service"
      description="This temporary page defines the current product intent for open-source and self-directed usage until fuller legal terms are published."
    >
      <p>
        DioTest Community Edition is provided for engineering, QA, and product teams that want local-first testing
        workflows and project-connected automation support.
      </p>
      <p>
        You are responsible for the repositories, credentials, and provider connections you configure. Validate
        generated outputs before using them in production workflows.
      </p>
      <p>
        This page is intentionally lightweight and product-neutral. Replace it with formal legal terms before relying
        on it for commercial or regulated deployments.
      </p>
    </InfoPageShell>
  );
}
