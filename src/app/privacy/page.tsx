import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — MenkeReport' }

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-menke-navy hover:underline">
            &larr; Back to dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-menke-navy mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="prose prose-sm max-w-none">
          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">1. Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            Menke &amp; Associates (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates MenkeReport (the
            &quot;Service&quot;), a web application for ESOP plan sponsors to model repurchase
            obligations, valuation projections, and participant population analytics. This
            Privacy Policy explains how we collect, use, and protect information that you
            provide while using the Service.
          </p>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">2. Information We Collect</h2>
          <p className="text-gray-700 leading-relaxed mb-2">
            We collect the minimum information needed to operate the Service:
          </p>
          <ul className="list-disc ml-6 text-gray-700 space-y-1.5 text-sm">
            <li><strong>Account information:</strong> email address, username, and hashed password (bcrypt via Supabase Auth).</li>
            <li><strong>Plan data you upload:</strong> participant census (names, birth/hire/termination dates, compensation), plan settings (vesting schedules, EBITDA, valuation inputs).</li>
            <li><strong>Usage data:</strong> timestamps of uploads, reports generated, and settings changes.</li>
            <li><strong>Technical data:</strong> browser type, IP address, and request logs for security and debugging.</li>
          </ul>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc ml-6 text-gray-700 space-y-1.5 text-sm">
            <li>To compute projections and reports you request.</li>
            <li>To provide access to your historical backups.</li>
            <li>To diagnose and fix application issues.</li>
            <li>To communicate with you about the Service (e.g., password resets).</li>
          </ul>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">4. Data Isolation &amp; Security</h2>
          <p className="text-gray-700 leading-relaxed">
            All plan data is stored in an encrypted Postgres database (Supabase) with
            Row-Level Security (RLS) policies that restrict access to your account only.
            Administrators cannot view your participant data; only the aggregate admin
            dashboard (user list, roles, statuses) is accessible to users with an
            administrator role.
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            Passwords are never stored in plaintext. Uploaded Excel files are stored in
            private cloud storage buckets with per-user access controls.
          </p>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">5. Data Retention</h2>
          <p className="text-gray-700 leading-relaxed">
            We retain your data for as long as your account is active. Backups (snapshots)
            are retained indefinitely until you delete them from the Backup History page.
            If you close your account, all associated plan data, backups, and formula
            configuration overrides are deleted within 30 days.
          </p>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">6. Third Parties</h2>
          <p className="text-gray-700 leading-relaxed">
            We use the following sub-processors to operate the Service:
          </p>
          <ul className="list-disc ml-6 text-gray-700 space-y-1.5 text-sm mt-2">
            <li><strong>Supabase</strong> — authentication, database, storage.</li>
            <li><strong>Vercel</strong> — application hosting.</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-2">
            We do not sell or share your plan data with advertisers or marketers.
          </p>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">7. Your Rights</h2>
          <ul className="list-disc ml-6 text-gray-700 space-y-1.5 text-sm">
            <li><strong>Access:</strong> export your current data via the &quot;Export to Excel&quot; feature on the Import page.</li>
            <li><strong>Correction:</strong> edit participant records directly via the Data Management page.</li>
            <li><strong>Deletion:</strong> delete individual participants or entire backups at any time.</li>
            <li><strong>Account closure:</strong> email support (see below) to request full account and data deletion.</li>
          </ul>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">8. Changes to This Policy</h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this Privacy Policy from time to time. Material changes will be
            communicated via in-app notification or email. Continued use of the Service
            after an update constitutes acceptance of the revised policy.
          </p>

          <h2 className="text-xl font-semibold text-menke-navy mt-8 mb-3">9. Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            Questions about this policy or your data? Contact us at{' '}
            <a href="mailto:privacy@menke.com" className="text-menke-navy hover:underline">
              privacy@menke.com
            </a>.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-200 text-xs text-gray-400 text-center">
          &copy; {new Date().getFullYear()} Menke &amp; Associates. ESOP Advisors Since 1974.
        </div>
      </div>
    </div>
  )
}
