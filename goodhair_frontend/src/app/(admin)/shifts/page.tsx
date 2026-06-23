import type { Metadata } from 'next';
import ShiftsClient from './ShiftsClient';

export const metadata: Metadata = { title: 'Ca làm việc | GoodHair' };

export default function ShiftsPage() {
  return (
    <div style={{ padding: 28 }}>
      <ShiftsClient />
    </div>
  );
}
