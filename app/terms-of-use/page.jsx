"use client";

// app/terms-of-use/page.jsx

import { useRouter } from 'next/navigation';

export default function TermsOfUsePage() {
  const router = useRouter();
  const handleBack = () => router.push('/register');

  return (
    <div className="p-8 max-w-3xl mx-auto text-white text-sm">
      <h1 className="text-3xl font-bold mb-4">PowerPlay Soccer - Terms of Use</h1>
      <p className="mb-2 italic">Last updated: June 2025</p>

      <p className="mb-4">By using PowerPlay Soccer, you agree to:</p>
      <ul className="list-disc list-inside mb-6">
        <li>Be truthful about your identity and age</li>
        <li>Use the platform respectfully and safely</li>
        <li>Follow parent approval for purchases (if under 13)</li>
        <li>Not download or alter media without permission</li>
        <li>Allow anonymous use of progress data to improve the app</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Eligibility</h2>
      <p>- Children under 13 may use the app only with verified parental consent.</p>
      <p>- Parents and coaches must be at least 18 years old.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Account Responsibilities</h2>
      <p>- Provide accurate information.</p>
      <p>- Don’t share passwords or impersonate others.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc list-inside">
        <li>Use the platform illegally or harmfully</li>
        <li>Post offensive or abusive content</li>
        <li>Hack or interfere with the system</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. XP Points and Subscriptions</h2>
      <ul className="list-disc list-inside">
        <li>XP can be earned or purchased (with parental approval)</li>
        <li>Subscriptions unlock bonus content</li>
        <li>XP has no cash value or refund rights</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Parent Supervision</h2>
      <ul className="list-disc list-inside">
        <li>Parents can approve XP purchases</li>
        <li>View player history and progress</li>
        <li>We encourage open dialogue</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. User Content & Progress Data</h2>
      <ul className="list-disc list-inside">
        <li>Training logs belong to the user</li>
        <li>We may use anonymized data to improve training</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">7–15. Legal Terms</h2>
      <ul className="list-disc list-inside">
        <li>We may suspend users for violations</li>
        <li>Terms may be updated with notice</li>
        <li>We rely on third-party services (e.g. Supabase)</li>
        <li>You receive a limited-use license</li>
        <li>Content is copyrighted — no unauthorized use</li>
        <li>No offline storage or redistribution of media</li>
        <li>Use is at your own risk</li>
        <li>Governed by UK law</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">16. Contact</h2>
      <p>Questions? Email <a href="mailto:support@powerplaysoccer.app" className="text-cyan-400 underline">support@powerplaysoccer.app</a></p>

      <div className="mt-8 text-center">
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded"
        >
          Back to Registration
        </button>
      </div>
    </div>
  );
}
