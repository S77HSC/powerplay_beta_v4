// app/page.jsx
import { redirect } from 'next/navigation';

export default function Home() {
  // Always route root to the login page.
  redirect('/login');
}
