import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ui/ProductCard';
import { Button } from '@/components/ui/Button';

// Static placeholder data based on the business requirements for Kimironko
const MOCK_PRODUCTS = [
  {
    id: 'p1',
    name: 'Fresh Tomatoes (Inyanya)',
    price: 1200,
    unit: 'kg',
    image: '/images/tomatoes.jpg',
    inStock: true,
  },
  {
    id: 'p2',
    name: 'Rwandan Coffee Beans',
    price: 8000,
    unit: '500g',
    image: '/images/coffee.jpg',
    inStock: true,
    promotion: {
      type: 'percentage' as const,
      discount: 15,
      promotedPrice: 6800,
    }
  },
  {
    id: 'p3',
    name: 'Irish Potatoes (Ibirayi)',
    price: 450,
    unit: 'kg',
    image: '/images/potatoes.jpg',
    inStock: true,
  },
  {
    id: 'p4',
    name: 'Premium Rice',
    price: 1500,
    unit: 'kg',
    image: '/images/rice.jpg',
    inStock: false,
  }
];

export default function MarketPage({ params }: { params: { slug: string } }) {
  // Normally we would fetch the market data using the slug
  const marketName = params.slug === 'kimironko' ? 'Kimironko Market' : `${params.slug} Shop`;

  return (
    <Layout marketName={marketName}>
      {/* Live Rider Availability Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-8 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
            <span className="absolute w-3 h-3 bg-status-success rounded-full top-0 right-0 border-2 border-white animate-pulse"></span>
            🏍️
          </div>
          <div>
            <h3 className="font-medium text-text-primary">Live Delivery Status</h3>
            <p className="text-sm text-text-secondary">12 active riders currently near {marketName}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          View Rider Map
        </Button>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Fresh Products</h1>
          <p className="text-text-secondary">Direct from verified sellers at {marketName}</p>
        </div>
        
        <div className="hidden sm:flex gap-2">
          <select className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option>All Categories</option>
            <option>Vegetables</option>
            <option>Fruits</option>
            <option>Grains</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {MOCK_PRODUCTS.map(product => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAddToCart={(id) => console.log(`Added ${id} to cart`)} 
          />
        ))}
      </div>
    </Layout>
  );
}
