'use client';
import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

const COLORS = ['#121212', '#F59E0B', '#A34D15', '#6B665E', '#1A1A1A'];

interface AnalyticsChartsProps {
  orders?: any[];
  data?: {
    trends: { date: string; revenue: number; count: number }[];
    statusDistribution: { name: string; value: number }[];
    performance: { name: string; revenue?: number; sales?: number }[];
  };
  type: 'admin' | 'seller';
}

export const AnalyticsCharts = ({ orders = [], data, type }: AnalyticsChartsProps) => {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
      {/* Revenue Trend */}
      <div className="bg-white p-10 border border-[#E5E1D8] shadow-sm relative group">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-10 flex items-center gap-4 text-[#121212]">
          <span className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></span>
          Revenue Trend (Last 7 Days)
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#121212', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#64748b' }} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip 
                contentStyle={{ background: '#121212', border: '1px solid #F59E0B', borderRadius: '0px', padding: '12px' }}
                itemStyle={{ color: '#F59E0B', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                labelStyle={{ color: '#fff', fontSize: '8px', marginBottom: '4px', fontWeight: 'bold' }}
                formatter={(value: any) => [`${value.toLocaleString()} RWF`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution */}
      <div className="bg-white p-10 border border-[#E5E1D8] shadow-sm relative group">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-10 flex items-center gap-4 text-[#121212]">
          <span className="w-2 h-2 bg-[#121212] rounded-full"></span>
          Order Status Distribution
        </h3>
        <div className="h-[300px] w-full flex items-center">
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ background: '#121212', border: '1px solid #F59E0B', borderRadius: '0px' }}
                 itemStyle={{ color: '#F59E0B', fontSize: '10px', fontWeight: '900' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="rect" formatter={(value) => <span className="text-[8px] font-black uppercase tracking-widest text-[#6B665E]">{value}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Bar Chart */}
      <div className="bg-white p-10 border-2 border-[#121212] shadow-[8px_8px_0_0_#121212] lg:col-span-2 mt-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-10 flex items-center gap-4 text-[#121212]">
          <span className="w-2 h-2 bg-[#A34D15] rounded-full"></span>
          {type === 'admin' ? 'Top Selling Vendors' : 'Top Performing Artifacts'}
        </h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData} layout="vertical" margin={{ left: 40, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#121212', textTransform: 'uppercase' }} width={120} />
              <Tooltip 
                cursor={{ fill: '#F8F6F1' }}
                contentStyle={{ background: '#121212', border: '1px solid #F59E0B', borderRadius: '0px' }}
                itemStyle={{ color: '#F59E0B', fontSize: '10px', fontWeight: '900' }}
                labelStyle={{ color: '#fff', fontSize: '8px', marginBottom: '4px' }}
              />
              <Bar 
                dataKey={type === 'admin' ? 'revenue' : 'sales'} 
                fill="#121212" 
                radius={[0, 0, 0, 0]} 
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
