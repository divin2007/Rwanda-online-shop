'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

const CHART_COLORS = ['#ff6b00', '#ea580c', '#405046', '#8ca197', '#ffedd5'];

interface AnalyticsChartsProps {
  orders?: any[];
  data?: {
    trends: { date: string; revenue: number; count: number }[];
    statusDistribution: { name: string; value: number }[];
    performance: { name: string; revenue?: number; sales?: number }[];
  };
  type: 'admin' | 'seller';
  hidePerformance?: boolean;
}

export const AnalyticsCharts = ({ orders = [], data, type, hidePerformance = false }: AnalyticsChartsProps) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-[320px] w-full animate-pulse rounded-lg border border-[#e0e0e0] bg-[#f7faf8]" />;
  // 1. Process data for Revenue Trend (Last 7 days)
  let revenueData = [];
  if (data?.trends) {
    revenueData = data.trends.map(t => ({
      date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: t.revenue
    }));
  } else {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    revenueData = last7Days.map(date => {
      const dayOrders = orders.filter(o => o.createdAt.startsWith(date));
      const total = dayOrders.reduce((sum, o) => sum + (o.financials?.totalAmount || 0), 0);
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: total
      };
    });
  }

  // 2. Process data for Order Status
  let statusData = [];
  if (data?.statusDistribution) {
    statusData = data.statusDistribution.map(s => ({
      name: s.name.charAt(0).toUpperCase() + s.name.slice(1).replace('_', ' '),
      value: s.value
    }));
  } else {
    const statusCounts = orders.reduce((acc: any, o) => {
      const status = o.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    statusData = Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value
    })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);
  }

  // 3. Process data for Top Sellers (Admin) or Top Products (Seller)
  let performanceData: any[] = [];
  if (data?.performance) {
    performanceData = data.performance;
  } else {
    if (type === 'admin') {
      const sellerSales = orders.reduce((acc: any, o) => {
        const name = o.seller?.fullName || 'Unknown';
        acc[name] = (acc[name] || 0) + (o.financials?.totalAmount || 0);
        return acc;
      }, {});
      performanceData = Object.entries(sellerSales).map(([name, revenue]) => ({ name, revenue }))
        .sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    } else {
      const productSales = orders.reduce((acc: any, o) => {
        const items = o.products || (o.product ? [o.product] : []);
        items.forEach((p: any) => {
          const name = p.name || 'Unknown';
          acc[name] = (acc[name] || 0) + (p.quantity || 1);
        });
        return acc;
      }, {});
      performanceData = Object.entries(productSales).map(([name, sales]) => ({ name, sales }))
        .sort((a: any, b: any) => b.sales - a.sales).slice(0, 5);
    }
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Revenue Trend */}
      <div className="group relative rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm">
        <h3 className="mb-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#1b1c1c]">
          <span className="h-2 w-2 rounded-full bg-[#ea580c]"></span>
          Revenue Trend (Last 7 Days)
        </h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#1b1c1c' }} minTickGap={15} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#64748b' }} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip 
                contentStyle={{ background: '#1b1c1c', border: '1px solid #ffedd5', borderRadius: '8px', padding: '12px' }}
                itemStyle={{ color: '#ffedd5', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                labelStyle={{ color: '#fff', fontSize: '8px', marginBottom: '4px', fontWeight: 'bold' }}
                formatter={(value: any) => [`${value.toLocaleString()} RWF`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution */}
      <div className="group relative rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm">
        <h3 className="mb-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#1b1c1c]">
          <span className="h-2 w-2 rounded-full bg-[#e05300]"></span>
          Order Status Distribution
        </h3>
        <div className="flex h-[280px] w-full items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ background: '#1b1c1c', border: '1px solid #ffedd5', borderRadius: '8px' }}
                 itemStyle={{ color: '#ffedd5', fontSize: '10px', fontWeight: '900' }}
              />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} iconType="rect" formatter={(value) => <span className="text-[8px] font-black uppercase tracking-widest text-[#414844] leading-relaxed">{value}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Bar Chart */}
      {!hidePerformance && (
        <div className="mt-1 rounded-lg border border-[#dfe7e2] bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-5 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#1b1c1c]">
            <span className="h-2 w-2 rounded-full bg-[#ff6b00]"></span>
            {type === 'admin' ? 'Top Selling Vendors' : 'Top Selling Products'}
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#1b1c1c' }} width={120} />
                <Tooltip 
                  cursor={{ fill: '#fcf9f8' }}
                  contentStyle={{ background: '#1b1c1c', border: '1px solid #ffedd5', borderRadius: '8px' }}
                  itemStyle={{ color: '#ffedd5', fontSize: '10px', fontWeight: '900' }}
                  labelStyle={{ color: '#fff', fontSize: '8px', marginBottom: '4px' }}
                />
                <Bar 
                  dataKey={type === 'admin' ? 'revenue' : 'sales'} 
                  fill="#ea580c" 
                  radius={[4, 4, 4, 4]} 
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
