'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface WishlistContextType {
  wishlist: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlist: [],
  toggleWishlist: async () => {},
  isInWishlist: () => false,
});

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      userApi.get('/users/wishlist')
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setWishlist(res.data.data.map((item: any) => typeof item === 'object' ? item._id : item));
          } else {
            setWishlist([]);
          }
        })
        .catch(err => {
          console.error('Failed to load wishlist', err);
          setWishlist([]);
        });
    } else {
      setWishlist([]);
    }
  }, [user]);

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      toast.error('Please log in to save items to your wishlist.');
      return;
    }

    const isSaved = wishlist.includes(productId);
    
    // Optimistic update
    setWishlist(prev => 
      isSaved ? prev.filter(id => id !== productId) : [...prev, productId]
    );

    try {
      if (isSaved) {
        await userApi.post('/users/wishlist/remove', { productId });
        toast.success('Removed from wishlist');
      } else {
        await userApi.post('/users/wishlist', { productId });
        toast.success('Added to wishlist');
      }
    } catch (e) {
      // Revert on failure
      setWishlist(prev => 
        isSaved ? [...prev, productId] : prev.filter(id => id !== productId)
      );
      toast.error('Failed to update wishlist');
    }
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
