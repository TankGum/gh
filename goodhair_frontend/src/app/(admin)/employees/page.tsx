import type { Metadata } from 'next';
import EmployeesClient from './EmployeesClient';

export const metadata: Metadata = { title: 'Nhân viên | GoodHair' };

export default function EmployeesPage() {
  return (
    <div style={{ padding: 28 }}>
      <EmployeesClient />
    </div>
  );
}
