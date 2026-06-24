import type { Metadata } from 'next';
import RolesClient from './RolesClient';

export const metadata: Metadata = { title: 'Quản lý vai trò | GoodHair' };

export default function RolesPage() {
  return (
    <div className="p-4 md:p-7">
      <RolesClient />
    </div>
  );
}
