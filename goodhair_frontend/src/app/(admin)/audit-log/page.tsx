import type { Metadata } from 'next';
import AuditLogClient from './AuditLogClient';

export const metadata: Metadata = { title: 'Nhật ký hoạt động | GoodHair' };

export default function AuditLogPage() {
  return (
    <div className="p-4 md:p-7">
      <AuditLogClient />
    </div>
  );
}
