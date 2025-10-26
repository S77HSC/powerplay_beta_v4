"use client";

// app/privacy-policy/page.jsx

import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const handleBack = () => router.push('/register');

  return (
    <div className="p-8 max-w-3xl mx-auto text-white text-sm">
      <h1 className="text-3xl font-bold mb-4">PowerPlay Soccer - Privacy Policy</h1>
      <p className="mb-2 italic">Last updated: June 2025</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Introduction</h2>
      <p>We care about your privacy. This policy explains what personal data we collect and how we use it to improve the PowerPlay experience.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. What We Collect</h2>
      <ul className="list-disc list-inside">
        <li>Name, age, country, email</li>
        <li>Team and role (player, parent, coach)</li>
        <li>XP earned, session progress, and performance logs</li>
        <li>Technical usage data (device/browser type)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. How We Use It</h2>
      <ul className="list-disc list-inside">
        <li>To manage your account and display your progress</li>
        <li>To reward activity and participation with XP points</li>
        <li>To connect players, coaches, and parents</li>
        <li>To improve features based on anonymized trends</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Sharing & Storage</h2>
      <ul className="list-disc list-inside">
        <li>We do not sell or share your personal info for advertising</li>
        <li>We use trusted third parties like Supabase for secure storage</li>
        <li>Data may be processed in the UK, EU, or US</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Children’s Privacy</h2>
      <ul className="list-disc list-inside">
        <li>Players under 13 must have parent approval</li>
        <li>Parent dashboards allow control and visibility</li>
        <li>We limit contact features and flag risky behavior</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Media Content</h2>
      <ul className="list-disc list-inside">
        <li>When the camera is in use, no video recordings are made or stored</li>
        <li>The camera is only used for intelligent analysis (e.g. counting touches)</li>
        <li>PowerPlay does not store or use any camera footage</li>
        <li>Videos and images are for in-app use only</li>
        <li>Users may not download, alter, or distribute media outside PowerPlay</li>
        <li>Sharing to social media is permitted via built-in tools</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">7. Your Rights</h2>
      <ul className="list-disc list-inside">
        <li>You may request to access, correct, or delete your data</li>
        <li>Parents may manage or delete child accounts</li>
        <li>To request data changes, contact us directly</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">8. Changes</h2>
      <p>We may update this policy. We’ll notify users of significant changes via email or app notice.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">9. Contact</h2>
      <p>For any privacy questions or requests, email <a href="mailto:privacy@powerplaysoccer.app" className="text-cyan-400 underline">privacy@powerplaysoccer.app</a>.</p>

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
