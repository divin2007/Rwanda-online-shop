import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { 
  User, CreditCard, Heart, Bell, Shield, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, 
  Trash2, ShoppingBag, Plus, RefreshCw 
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [wishlist, setWishlist] = useState<string[]>(['6a0b6bf6df45118d6914fd26']);
  const toggleWishlist = (id: string) => setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const [activeSegment, setActiveSegment] = useState<'wallet' | 'wishlist' | 'alerts'>('wallet');
  
  // Wallet states
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Deposit & Withdraw Form States
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmt, setDepositAmt] = useState('');
  const [depositPhone, setDepositPhone] = useState(user?.phone || '0788888888');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState(user?.phone || '0788888888');
  const [actionLoading, setActionLoading] = useState(false);

  // Dynamic Alerts / notifications state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Saved / Wishlisted products loaded state
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchWalletDetails();
    fetchWishlistProducts();
    fetchAlerts();
  }, [wishlist, user]);

  const fetchAlerts = async () => {
    if (!user) return;
    setLoadingAlerts(true);
    try {
      const data = await api.get<any[]>('notification', '/notifications/me');
      if (Array.isArray(data)) {
        setAlerts(data.map(item => ({
          id: item._id,
          title: item.title || item.type || 'RMF Alert',
          body: item.message || item.body || '',
          time: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Just now',
          read: item.isRead || false,
        })));
      }
    } catch (err) {
      console.warn('Notification service offline.');
    } finally {
      setLoadingAlerts(false);
    }
  };

  const fetchWalletDetails = async () => {
    if (!user?.id) return;
    setLoadingWallet(true);
    try {
      const data = await api.get<any>('wallet', `/wallets/me?userId=${user.id}`);
      if (data) {
        setBalance(data.balance || 0);
      }
      const txData = await api.get<any[]>('wallet', `/wallets/me/transactions?userId=${user.id}`);
      if (Array.isArray(txData)) {
        setTransactions(txData);
      }
    } catch (err) {
      console.warn('Wallet Service offline.');
    } finally {
      setLoadingWallet(false);
    }
  };

  const fetchWishlistProducts = async () => {
    if (wishlist.length === 0) {
      setWishlistProducts([]);
      return;
    }
    try {
      const data = await api.get<any[]>('product', '/products', { auth: false });
      if (Array.isArray(data)) {
        const matched = data.filter((p: any) => wishlist.includes(p._id));
        setWishlistProducts(matched);
      }
    } catch (err) {
      console.warn('Products Service offline.');
    }
  };

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please input a valid top-up amount.');
      return;
    }
    setActionLoading(true);
    try {
      const data = await api.post('wallet', `/wallets/${user?.id}/deposit`, { amount: amt, method: 'momo', phone: depositPhone });
      if (data) {
        Alert.alert('Deposit Initiated', 'A MoMo authorization prompt has been pushed to your phone!');
        setDepositAmt('');
        fetchWalletDetails();
      }
    } catch (err) {
      // Simulate fallback deposit
      setBalance(prev => prev + amt);
      const newTx = {
        _id: 'local_tx_' + Math.random().toString(36).substring(7),
        type: 'DEPOSIT',
        amount: amt,
        description: 'MoMo Top-up (Local Sandbox)',
        createdAt: new Date().toISOString(),
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      Alert.alert('Simulated Deposit', 'MoMo top-up prompt authorized. Sandbox wallet balance updated!');
      setDepositAmt('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please input a valid withdrawal amount.');
      return;
    }
    if (amt > balance) {
      Alert.alert('Insufficient Balance', 'You cannot cash out more than your available wallet balance.');
      return;
    }
    setActionLoading(true);
    try {
      const data = await api.post('wallet', `/wallets/user/${user?.id}/payout`, { amount: amt, method: 'momo', recipientPhone: withdrawPhone });
      if (data) {
        Alert.alert('Payout Processed', 'Payout transaction submitted to MTN MoMo gateway!');
        setWithdrawAmt('');
        fetchWalletDetails();
      }
    } catch (err) {
      // Simulate withdrawal payout
      setBalance(prev => prev - amt);
      const newTx = {
        _id: 'local_tx_' + Math.random().toString(36).substring(7),
        type: 'WITHDRAWAL',
        amount: amt,
        description: 'Payout to MoMo (Local Sandbox)',
        createdAt: new Date().toISOString(),
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      Alert.alert('Simulated Cash-Out', 'MoMo cash-out approved. Sandbox wallet balance updated!');
      setWithdrawAmt('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToCart = (item: any) => {
    const cartItem = {
      productId: item._id,
      name: item.name,
      unitPrice: item.price,
      quantity: 1,
      unit: item.unit || 'pair',
      category: item.categoryLabel || 'Shoes & Footwear',
      imageUrl: item.images?.[0] || 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500',
      sellerId: 'seller_123',
      sellerName: 'murekatete Stall',
      stallId: 'stall_123',
      marketId: 'market_123'
    };
    addItem(cartItem as any);
    router.push('/cart' as any);
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <View style={[styles.emptyItemsCard, { width: '100%' }]}>
          <User color="#8e9e95" size={48} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyItemsTitle}>Sign in to view your dashboard</Text>
          <Text style={styles.emptyItemsDesc}>Log in to access your wallet balance, transactional alerts, and wishlist tracking.</Text>
          <TouchableOpacity 
            style={[styles.formSubmitBtn, { width: '100%', paddingHorizontal: 20 }]} 
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.formSubmitBtnTxt}>Sign In Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Profile & Account Summary Card ── */}
      <View style={styles.profileSummaryBlock}>
        <View style={styles.avatarCircle}>
          <User color="#ffffff" size={24} />
        </View>
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{user?.fullName || 'Valued Member'}</Text>
          <View style={styles.verifiedRow}>
            <ShieldCheck color="#22c55e" size={14} />
            <Text style={styles.roleLabel}>{user?.role?.toUpperCase()} ACCOUNT</Text>
          </View>
          <Text style={styles.phoneLabel}>PHONE: {user?.phone || 'Unknown'}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutBtnTxt}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Dynamic Tab Segment Selector ── */}
      <View style={styles.segmentBar}>
        <TouchableOpacity 
          style={[styles.segmentBtn, activeSegment === 'wallet' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('wallet')}
        >
          <CreditCard color={activeSegment === 'wallet' ? '#ffffff' : '#8e9e95'} size={14} />
          <Text style={[styles.segmentTxt, activeSegment === 'wallet' && styles.segmentTxtActive]}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.segmentBtn, activeSegment === 'wishlist' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('wishlist')}
        >
          <Heart color={activeSegment === 'wishlist' ? '#ffffff' : '#8e9e95'} size={14} />
          <Text style={[styles.segmentTxt, activeSegment === 'wishlist' && styles.segmentTxtActive]}>Wishlist ({wishlist.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.segmentBtn, activeSegment === 'alerts' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('alerts')}
        >
          <Bell color={activeSegment === 'alerts' ? '#ffffff' : '#8e9e95'} size={14} />
          <Text style={[styles.segmentTxt, activeSegment === 'alerts' && styles.segmentTxtActive]}>Alerts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Segment 1: Live Wallet Hub ── */}
        {activeSegment === 'wallet' && (
          <View style={styles.subContainer}>
            {/* Wallet Balance Board */}
            <View style={styles.walletCard}>
              <View style={styles.walletHeaderRow}>
                <Text style={styles.walletHeaderLabel}>RMF WALLET SYSTEM</Text>
                <TouchableOpacity onPress={fetchWalletDetails} activeOpacity={0.7}>
                  <RefreshCw color="#ffffff" size={14} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <Text style={styles.balanceVal}>{balance.toLocaleString()} RWF</Text>
              
              <View style={styles.walletFooterRow}>
                <Text style={styles.walletAccountID}>ID: #{user?.id?.substring(0, 8)}</Text>
                <Text style={styles.walletVerifiedTxt}>SECURED BY MTN MOMO</Text>
              </View>
            </View>

            {/* Wallet Action Tabs */}
            <View style={styles.actionTabRow}>
              <TouchableOpacity 
                style={[styles.actionTabBtn, walletTab === 'deposit' && styles.actionTabBtnActive]}
                onPress={() => setWalletTab('deposit')}
              >
                <Text style={[styles.actionTabTxt, walletTab === 'deposit' && styles.actionTabTxtActive]}>DEPOSIT</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionTabBtn, walletTab === 'withdraw' && styles.actionTabBtnActive]}
                onPress={() => setWalletTab('withdraw')}
              >
                <Text style={[styles.actionTabTxt, walletTab === 'withdraw' && styles.actionTabTxtActive]}>WITHDRAW</Text>
              </TouchableOpacity>
            </View>

            {/* MoMo Action Form Box */}
            {walletTab === 'deposit' ? (
              <View style={styles.formBox}>
                <Text style={styles.formTitle}>Add Funds to Wallet</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>AMOUNT (RWF)</Text>
                  <TextInput 
                    placeholder="e.g. 10000"
                    placeholderTextColor="#8e9e95"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={depositAmt}
                    onChangeText={setDepositAmt}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MTN MOMO NUMBER</Text>
                  <TextInput 
                    placeholder="0788888888"
                    placeholderTextColor="#8e9e95"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                    value={depositPhone}
                    onChangeText={setDepositPhone}
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.formSubmitBtn}
                  onPress={handleDeposit}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.formSubmitBtnTxt}>INITIATE DEPOSIT PROMPT</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formBox}>
                <Text style={styles.formTitle}>Request MoMo Payout</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>AMOUNT (RWF)</Text>
                  <TextInput 
                    placeholder="e.g. 5000"
                    placeholderTextColor="#8e9e95"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={withdrawAmt}
                    onChangeText={setWithdrawAmt}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>RECIPIENT MOMO NUMBER</Text>
                  <TextInput 
                    placeholder="0788888888"
                    placeholderTextColor="#8e9e95"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                    value={withdrawPhone}
                    onChangeText={setWithdrawPhone}
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.formSubmitBtn}
                  onPress={handleWithdrawal}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.formSubmitBtnTxt}>REQUEST PAYOUT CASH-OUT</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Transactions Log Feed */}
            <Text style={styles.subHeading}>Transaction Logs</Text>
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <View key={tx._id} style={styles.txRow}>
                  <View style={[styles.txIconBox, tx.type === 'DEPOSIT' ? styles.txIconBoxDeposit : styles.txIconBoxWithdraw]}>
                    {tx.type === 'DEPOSIT' ? <ArrowDownLeft color="#16a34a" size={16} /> : <ArrowUpRight color="#ef4444" size={16} />}
                  </View>
                  
                  <View style={styles.txDetails}>
                    <Text style={styles.txDesc}>{tx.description || tx.type}</Text>
                    <Text style={styles.txTime}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                  </View>

                  <Text style={[styles.txAmt, tx.type === 'DEPOSIT' ? styles.txAmtDeposit : styles.txAmtWithdraw]}>
                    {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount?.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Segment 2: Saved / Wishlisted Items Grid ── */}
        {activeSegment === 'wishlist' && (
          <View style={styles.subContainer}>
            <Text style={styles.subHeading}>My Saved Products</Text>
            
            {wishlistProducts.length === 0 ? (
              <View style={styles.emptyItemsCard}>
                <Heart color="#8e9e95" size={48} />
                <Text style={styles.emptyItemsTitle}>Your Wishlist is Empty</Text>
                <Text style={styles.emptyItemsDesc}>Tap the heart icon on any product showcase to save it here for offline tracking!</Text>
              </View>
            ) : (
              <View style={styles.wishlistGrid}>
                {wishlistProducts.map((item) => (
                  <View key={item._id} style={styles.wishlistRowCard}>
                    <Image source={{ uri: item.images?.[0] }} style={styles.wishlistProductImg} />
                    
                    <View style={styles.wishlistMeta}>
                      <Text style={styles.wishlistCat}>{item.categoryLabel?.toUpperCase() || 'GENERAL'}</Text>
                      <Text style={styles.wishlistName}>{item.name}</Text>
                      <Text style={styles.wishlistPrice}>{item.price?.toLocaleString()} RWF</Text>
                    </View>

                    <View style={styles.wishlistActions}>
                      <TouchableOpacity 
                        style={styles.cartActionBtn}
                        onPress={() => handleMoveToCart(item)}
                      >
                        <ShoppingBag color="#ffffff" size={14} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.deleteActionBtn}
                        onPress={() => toggleWishlist(item._id)}
                      >
                        <Trash2 color="#ef4444" size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Segment 3: Original Transactional Alert Feed ── */}
        {activeSegment === 'alerts' && (
          <View style={styles.subContainer}>
            <Text style={styles.subHeading}>Activity & Security Feed</Text>
            
            {alerts.length === 0 ? (
              <View style={styles.emptyItemsCard}>
                <Bell color="#8e9e95" size={48} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyItemsTitle}>No Activity Logs</Text>
                <Text style={styles.emptyItemsDesc}>Live transactional updates, security alerts, and delivery milestones will appear here.</Text>
              </View>
            ) : (
              <View style={styles.alertsList}>
                {alerts.map((item) => (
                  <View key={item.id} style={[styles.alertCard, !item.read && styles.alertCardUnread]}>
                    <View style={styles.alertHeader}>
                      <View style={styles.alertDot} />
                      <Text style={styles.alertTitle}>{item.title}</Text>
                      <Text style={styles.alertTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.alertBody}>{item.body}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f5',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSummaryBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1eee9',
    padding: 20,
    gap: 16,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnTxt: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a63f00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#22c55e',
    letterSpacing: 1,
  },
  phoneLabel: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '700',
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1eee9',
    height: 48,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#a63f00',
    backgroundColor: '#fff7ed',
  },
  segmentTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  segmentTxtActive: {
    color: '#a63f00',
  },
  subContainer: {
    padding: 20,
  },
  walletCard: {
    backgroundColor: '#a63f00',
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#a63f00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletHeaderLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffd700',
    letterSpacing: 1,
  },
  balanceLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
  },
  balanceVal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
    marginBottom: 16,
  },
  walletFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletAccountID: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  walletVerifiedTxt: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ffd700',
    letterSpacing: 0.5,
  },
  actionTabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 14,
    height: 44,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionTabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTabBtnActive: {
    backgroundColor: '#a63f00',
  },
  actionTabTxt: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  actionTabTxtActive: {
    color: '#ffffff',
  },
  formBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
    gap: 6,
  },
  inputLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8e9e95',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1b1c1c',
    fontWeight: '600',
    backgroundColor: '#faf8f5',
  },
  formSubmitBtn: {
    backgroundColor: '#a63f00',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  formSubmitBtnTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 12,
  },
  txList: {
    gap: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 12,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txIconBoxDeposit: {
    backgroundColor: '#dcfce7',
  },
  txIconBoxWithdraw: {
    backgroundColor: '#fee2e2',
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  txDesc: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  txTime: {
    fontSize: 9,
    color: '#8e9e95',
    fontWeight: '600',
  },
  txAmt: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  txAmtDeposit: {
    color: '#16a34a',
  },
  txAmtWithdraw: {
    color: '#ef4444',
  },
  emptyItemsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyItemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  emptyItemsDesc: {
    fontSize: 12,
    color: '#8e9e95',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  wishlistGrid: {
    gap: 12,
  },
  wishlistRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 12,
  },
  wishlistProductImg: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#faf8f5',
  },
  wishlistMeta: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  wishlistCat: {
    fontSize: 8,
    fontWeight: '900',
    color: '#a63f00',
    letterSpacing: 0.5,
  },
  wishlistName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  wishlistPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8e9e95',
  },
  wishlistActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cartActionBtn: {
    backgroundColor: '#a63f00',
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fff5f5',
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1eee9',
    borderRadius: 16,
    padding: 16,
  },
  alertCardUnread: {
    borderColor: '#ffd700',
    backgroundColor: '#fffbeb',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a63f00',
  },
  alertTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  alertTime: {
    fontSize: 9,
    color: '#8e9e95',
    fontWeight: '600',
  },
  alertBody: {
    fontSize: 11,
    color: '#414844',
    lineHeight: 16,
    fontWeight: '550',
    paddingLeft: 14,
  },
});
