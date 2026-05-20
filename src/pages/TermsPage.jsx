import LegalPageLayout from "../components/legal/LegalPageLayout";

const LAST_UPDATED = "May 21, 2026";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        By using EngageHub you agree to these terms. EngageHub lets you connect social accounts, create content, and
        schedule posts. If you do not agree, please do not use the service.
      </p>
      <p>
        You must be at least 18 and provide accurate account details. You are responsible for your login credentials
        and all activity on your account. When you connect third-party platforms, you authorize us to use the access you
        grant only to provide the service. You own your content; you give us permission to process and publish it where
        you choose. You must have the rights to post that content.
      </p>
      <p>
        Do not use EngageHub for illegal activity, spam, malware, or content that violates others&apos; rights. Do not
        abuse, scrape, or attempt to disrupt the service. We may suspend accounts that break these rules.
      </p>
      <p>
        The service is provided &quot;as is&quot; without warranties. We are not liable for indirect damages or platform
        rejections beyond what the law requires. Paid plans, if offered, follow the billing terms shown at purchase. We
        may update these terms by posting a new version; continued use means you accept the changes.
      </p>
      <p>
        Questions:{" "}
        <a
          href="mailto:legal@engagehub.app"
          className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-600 dark:text-slate-200 dark:hover:text-white"
        >
          legal@engagehub.app
        </a>
      </p>
    </LegalPageLayout>
  );
}
