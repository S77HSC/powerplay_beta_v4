// app/boostball/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0; // <-- number or false, exported from a server file

import BoostballClient from './BoostballClient';

export default function BoostballPage() {
  // Server component that just renders the client UI
  return <BoostballClient />;
}
