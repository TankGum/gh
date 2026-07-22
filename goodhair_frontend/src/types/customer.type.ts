export interface CustomerServiceBreakdown {
  serviceId: string | null;
  serviceName: string;
  serviceDescription: string | null;
  count: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalVisits: number;
  totalSpent: number;
  lastVisitDate: string | null;
  serviceBreakdown: CustomerServiceBreakdown[];
}
