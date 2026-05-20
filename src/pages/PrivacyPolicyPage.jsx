import LegalPageLayout from "../components/legal/LegalPageLayout";

const LAST_UPDATED = "May 21, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        EngageHub collects information needed to run the service: your name, email, account settings, connected
        platform tokens and profile data, posts and schedules you create, and basic usage logs (such as device type and
        IP) for security and reliability.
      </p>
      <p>
        We use this data to authenticate you, connect platforms, publish or schedule content you request, send important
        service messages, and improve the product. We do not sell your personal information. We share data only with
        platforms you connect, trusted service providers under contract, or when required by law.
      </p>
      <p>
        We keep data while your account is active and for a reasonable period afterward. We use standard security
        measures, but no system is perfectly secure—protect your password and disconnect platforms you no longer use.
      </p>
      <p>
        You may update account details in settings, disconnect linked accounts, or contact us to request access,
        correction, or deletion where applicable. We may update this policy by posting a new date on this page.
      </p>
      <p>
        Privacy requests:{" "}
        <a
          href="mailto:privacy@engagehub.app"
          className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-600 dark:text-slate-200 dark:hover:text-white"
        >
          privacy@engagehub.app
        </a>
      </p>
    </LegalPageLayout>
  );
}
