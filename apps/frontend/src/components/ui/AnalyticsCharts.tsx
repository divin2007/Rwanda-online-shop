'use client';
import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface AnalyticsChartsProps {
  orders: any[];
  type: 'admin' | 'seller';
}

export const AnalyticsCharts = ({ orders, type }: AnalyticsChartsProps) => {
  // 1. Process data for Revenue Trend (Last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const revenueData = last7Days.map(date => {
    const dayOrders = orders.filter(o => o.createdAt.startsWith(date));
    const total = dayOrders.reduce((sum, o) => sum + (o.financials?.totalAmount || 0), 0);
    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: total
    };
  });

  // 2. Process data for Order Status
  const statusCounts = orders.reduce((acc: any, o) => {
    const status = o.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value
  })).sort((a: any, b: any) => b.value - a.value).slice(0, 5);

  // 3. Process data for Top Sellers (Admin) or Top Products (Seller)
  let performanceData: any[] = [];
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Revenue Trend */}
      <div className="bg-background-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          Revenue Trend (Last 7 Days)
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`${value.toLocaleString()} RWF`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution */}
      <div className="bg-background-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
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
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Bar Chart */}
      <div className="bg-background-card p-6 rounded-xl border border-border shadow-sm lg:col-span-2">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          {type === 'admin' ? 'Top Selling Vendors' : 'Top Performing Products'}
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData} layout="vertical" margin={{ left: 40, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={120} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey={type === 'admin' ? 'revenue' : 'sales'} 
                fill="#8b5cf6" 
                radius={[0, 4, 4, 0]} 
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
