import { redirect } from 'next/navigation';

export default function BlueProDashboardRedirect({ searchParams }: { searchParams: { payment?: string; credits?: string } }) {
  const params = new URLSearchParams();
  if (typeof searchParams.payment === 'string') params.set('payment', searchParams.payment);
  if (typeof searchParams.credits === 'string') params.set('credits', searchParams.credits);
  redirect('/console' + (params.size ? '?' + params.toString() : ''));
}
