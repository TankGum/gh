import { Suspense } from 'react';
import BookingsClient from './BookingsClient';

export default function Page() {
  return (
    <Suspense>
      <BookingsClient />
    </Suspense>
  );
}
