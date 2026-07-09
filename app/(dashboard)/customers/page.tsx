import { redirect } from 'next/navigation';

// The opportunities pipeline now lives inside the CRM hub. The 360° person page
// at /customers/[id] is unaffected.
export default function CustomersPage() {
  redirect('/crm');
}
