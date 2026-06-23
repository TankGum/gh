import type { Metadata } from 'next';
import RolesClient from './RolesClient';

export const metadata: Metadata = { title: 'Quản lý vai trò | GoodHair' };

export default function RolesPage() {
  return (
    <div style={{ padding: 28 }}>
      <RolesClient />
    </div>
  );
}
