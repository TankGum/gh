import type { Metadata } from 'next';
import RevenueClient from './RevenueClient';

export const metadata: Metadata = { title: 'Doanh thu | GoodHair' };

export default function RevenuePage() {
  return (
    <div style={{ padding: 28 }}>
      <RevenueClient />
    </div>
  );
}
