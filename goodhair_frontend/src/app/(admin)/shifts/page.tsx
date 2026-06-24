import type { Metadata } from 'next';
import ShiftsClient from './ShiftsClient';

export const metadata: Metadata = { title: 'Ca làm việc | GoodHair' };

export default function ShiftsPage() {
  return (
    <div className="p-4 md:p-7">
      <ShiftsClient />
    </div>
  );
}
