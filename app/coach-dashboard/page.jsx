// app/coach-dashboard/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0; // MUST be a number or false, from a server file

import CoachDashboard from '../../components/CoachDashboard';

export default function CoachDashboardPage() {
  return <CoachDashboard />;
}
