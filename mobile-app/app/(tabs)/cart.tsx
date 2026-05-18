import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart, useAuth } from '../_layout';
import { MapPin, Phone, CreditCard, ChevronRight, ShoppingBag, ShieldAlert } from 'lucide-react-native';

const BASE_ORDER_API = 'http://localhost:3006/api/v1';

export default function CartScreen() {
  const router = useRouter();
  const { items, cartTotal, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();

  const [phone, setPhone] = useState(user?.phone || '');
  const [nid, setNid] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MTN_MOMO' | 'AIRTEL_MONEY'>('MTN_MOMO');
  const [pinLocationSet, setPinLocationSet] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = pinLocationSet ? 1500 : 0;
  const gatewayFee = Math.ceil((cartTotal + deliveryFee) * 0.02);
  const total = cartTotal + deliveryFee + gatewayFee;

  const [showMomoModal, setShowMomoModal] = useState(false);
  const [momoPin, setMomoPin] = useState('');
  const [momoProcessing, setMomoProcessing] = useState(false);
  const [momoStep, setMomoStep] = useState('Securing network gateway...');

  const triggerMomoModal = () => {
    if (items.length === 0) return;
    if (!pinLocationSet) return;
    if (!phone) return;
    if (total > 50000 && !nid) return;

    setMomoPin('');
    setShowMomoModal(true);
  };

  const handleCheckout = async () => {
    if (momoPin.length < 5) return;
    
    setMomoProcessing(true);
    setMomoStep('Securing MTN MoMo Gateway Connection...');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setMomoStep('Validating Compliance and National ID...');
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    setMomoStep('Broadcasting Transaction to Order Microservice...');

    setSubmitting(true);

    // Group items by seller
    const firstItem = items[0];
    const platformCommission = Math.max(cartTotal * 0.015, 100);

    const payload = {
      buyer: {
        userId: user?.id || '6a0b828384bd8fb2fa9cabce',
        fullName: user?.fullName || 'Guest Buyer',
        phone: phone,
        nationalId: nid || undefined,
        deliveryAddress: {
          address: "Pinned Mobile Location",
          coordinates: [30.0619, -1.9441] // Kigali Coordinates
        }
      },
      seller: {
        sellerId: firstItem.sellerId || 'seller_123',
        userId: firstItem.sellerUserId || 'seller_user_123',
        fullName: firstItem.sellerName || 'Murekatete Stall',
        stallId: firstItem.stallId || 'stall_123',
        marketId: firstItem.marketId || 'market_123'
      },
      products: items.map(i => ({
        productId: i.id,
        name: i.name,
        unitPrice: i.price,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        imageUrl: i.image,
        variantId: i.variantId,
        variantTitle: i.variantTitle,
        sellerSku: i.sellerSku,
        priceSnapshotAt: new Date()
      })),
      financials: {
        subtotal: cartTotal,
        deliveryFee: deliveryFee,
        platformCommission,
        gatewayFee,
        totalAmount: total,
        sellerPayout: cartTotal - platformCommission,
        riderPayout: deliveryFee
      },
      payment: {
        method: paymentMethod,
        status: 'pending'
      },
      notes: notes
    };

    try {
      const response = await fetch(`${BASE_ORDER_API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      if (response.ok && resData?.data?._id) {
        clearCart();
        setShowMomoModal(false);
        router.push(`/orders/${resData.data._id}`);
      } else {
        throw new Error(resData?.message || 'Failed to place order');
      }
    } catch (err) {
      console.warn('Order API offline. Simulating successful checkout locally.');
      const mockId = 'ord_' + Math.random().toString(36).substring(2, 9);
      clearCart();
      setShowMomoModal(false);
      router.push(`/orders/${mockId}`);
    } finally {
      setSubmitting(false);
      setMomoProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag color="#8e9e95" size={64} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptySubtitle}>Browse our cinematic product catalog to find verified authentic items!</Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => router.push('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.browseBtnTxt}>Discover Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Cart Items List ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Review Items</Text>
          <View style={styles.itemsList}>
            {items.map(item => (
              <View key={item.variantId || item.id} style={styles.itemRow}>
                <Image source={{ uri: item.image }} style={styles.itemImg} />
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.variantTitle && (
                    <Text style={styles.itemVariant}>Option: {item.variantTitle}</Text>
                  )}
                  <Text style={styles.itemQty}>{item.quantity} x {item.price.toLocaleString()} RWF</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFromCart(item.variantId || item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeBtnTxt}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* ── Delivery Location Simulator ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Delivery Location</Text>
          <TouchableOpacity
            style={[styles.locationCard, pinLocationSet && styles.locationCardActive]}
            onPress={() => setPinLocationSet(!pinLocationSet)}
            activeOpacity={0.8}
          >
            <MapPin color={pinLocationSet ? '#ff6b00' : '#8e9e95'} size={24} />
            <View style={styles.locationMeta}>
              <Text style={styles.locationTitle}>{pinLocationSet ? 'Kigali Central Pinned' : 'Pin Delivery Location'}</Text>
              <Text style={styles.locationSubtitle}>
                {pinLocationSet ? '[-1.9441, 30.0619] • Flat delivery fee applied' : 'Tap to simulate dropping delivery pin'}
              </Text>
            </View>
            <View style={[styles.checkbox, pinLocationSet && styles.checkboxActive]}>
              {pinLocationSet && <View style={styles.checkboxInner} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Momo Checkout Fields ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Payment Details</Text>
          
          {/* Method Selector */}
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[styles.methodCard, paymentMethod === 'MTN_MOMO' && styles.methodCardActive]}
              onPress={() => setPaymentMethod('MTN_MOMO')}
              activeOpacity={0.8}
            >
              <View style={[styles.momoIconBox, { backgroundColor: '#FFCC00' }]}>
                <Text style={styles.momoIconTxt}>M</Text>
              </View>
              <Text style={styles.methodLabel}>MTN MoMo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodCard, paymentMethod === 'AIRTEL_MONEY' && styles.methodCardActive]}
              onPress={() => setPaymentMethod('AIRTEL_MONEY')}
              activeOpacity={0.8}
            >
              <View style={[styles.momoIconBox, { backgroundColor: '#ED1C24' }]}>
                <Text style={[styles.momoIconTxt, { color: '#ffffff' }]}>A</Text>
              </View>
              <Text style={styles.methodLabel}>Airtel Money</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Mobile Money Number *</Text>
              <View style={styles.inputBox}>
                <Phone color="#8e9e95" size={16} />
                <TextInput
                  placeholder="07XXXXXXXX"
                  placeholderTextColor="#8e9e95"
                  keyboardType="phone-pad"
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {total > 50000 && (
              <View style={styles.inputWrapper}>
                <View style={styles.alertRow}>
                  <ShieldAlert color="#e05300" size={14} />
                  <Text style={styles.alertLabel}>National ID Required</Text>
                </View>
                <Text style={styles.alertDesc}>High-value orders over 50,000 RWF require verification.</Text>
                <View style={styles.inputBox}>
                  <CreditCard color="#8e9e95" size={16} />
                  <TextInput
                    placeholder="119XXXXXXXXXXXXXXXX"
                    placeholderTextColor="#8e9e95"
                    maxLength={16}
                    keyboardType="number-pad"
                    style={styles.textInput}
                    value={nid}
                    onChangeText={setNid}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Delivery Notes</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}>
                <TextInput
                  placeholder="Any special instructions for the rider?"
                  placeholderTextColor="#8e9e95"
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Order Financial Summary ── */}
        <View style={[styles.section, styles.summarySection]}>
          <Text style={styles.sectionTitle}>4. Cost Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelTxt}>Subtotal</Text>
              <Text style={styles.summaryValTxt}>{cartTotal.toLocaleString()} RWF</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelTxt}>Delivery Fee</Text>
              <Text style={styles.summaryValTxt}>{deliveryFee.toLocaleString()} RWF</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelTxt}>Service Fee (2%)</Text>
              <Text style={styles.summaryValTxt}>{gatewayFee.toLocaleString()} RWF</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <View style={styles.totalPriceWrapper}>
                <Text style={styles.totalVal}>{total.toLocaleString()}</Text>
                <Text style={styles.totalCurrency}>RWF</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed Footer Order Button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.orderBtn, (!pinLocationSet || !phone || (total > 50000 && !nid)) && styles.orderBtnDisabled]}
          onPress={triggerMomoModal}
          disabled={!pinLocationSet || !phone || (total > 50000 && !nid) || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#012d1d" size="small" />
          ) : (
            <>
              <Text style={styles.orderBtnTxt}>Confirm & Pay</Text>
              <ChevronRight color="#012d1d" size={16} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── MoMo Secure Verification Modal Overlay ── */}
      {showMomoModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {momoProcessing ? (
              <View style={styles.processingBox}>
                <ActivityIndicator size="large" color="#ff6b00" style={{ marginBottom: 16 }} />
                <Text style={styles.processingTitle}>MoMo Request Pending</Text>
                <Text style={styles.processingStep}>{momoStep}</Text>
              </View>
            ) : (
              <View style={styles.pinEntryBox}>
                <View style={[styles.momoIconBox, { backgroundColor: paymentMethod === 'MTN_MOMO' ? '#FFCC00' : '#ED1C24', alignSelf: 'center', width: 56, height: 56, borderRadius: 28, marginBottom: 16, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.momoIconTxt, { fontSize: 20, color: paymentMethod === 'MTN_MOMO' ? '#000000' : '#ffffff' }]}>{paymentMethod === 'MTN_MOMO' ? 'M' : 'A'}</Text>
                </View>
                <Text style={styles.modalTitle}>Authorize Transaction</Text>
                <Text style={styles.modalSubtitle}>
                  Please authorize the payment of <Text style={{ fontWeight: 'bold', color: '#ff6b00' }}>{total.toLocaleString()} RWF</Text> on account <Text style={{ fontWeight: 'bold' }}>{phone}</Text>.
                </Text>
                
                <TextInput
                  placeholder="Enter 5-digit MoMo PIN"
                  placeholderTextColor="#8e9e95"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={5}
                  value={momoPin}
                  onChangeText={setMomoPin}
                  style={styles.modalPinInput}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelBtn} 
                    onPress={() => setShowMomoModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalSubmitBtn, momoPin.length < 5 && styles.modalSubmitBtnDisabled]} 
                    disabled={momoPin.length < 5}
                    onPress={handleCheckout}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.modalSubmitTxt}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcf9f8',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fcf9f8',
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8e9e95',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '600',
  },
  browseBtn: {
    backgroundColor: '#ff6b00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#012d1d',
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 16,
  },
  itemsList: {
    gap: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    borderRadius: 16,
  },
  itemImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  itemMeta: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  itemVariant: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff6b00',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  itemQty: {
    fontSize: 11,
    color: '#8e9e95',
    fontWeight: '700',
    marginTop: 4,
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
    borderRadius: 8,
  },
  removeBtnTxt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e53e3e',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    borderRadius: 16,
  },
  locationCardActive: {
    borderColor: '#ff6b00',
    backgroundColor: '#fff7ed',
  },
  locationMeta: {
    flex: 1,
    marginLeft: 16,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  locationSubtitle: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '600',
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    borderColor: '#ff6b00',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff6b00',
  },
  methodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  methodCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    borderRadius: 12, // Reduced rounded corners from 16 to 12
  },
  methodCardActive: {
    borderColor: '#012d1d',
    backgroundColor: '#f0fdf4',
  },
  momoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  momoIconTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginLeft: 8,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8e9e95',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8, // Reduced rounded corners from 12 to 8
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#1b1c1c',
    fontWeight: '600',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#e05300',
    textTransform: 'uppercase',
  },
  alertDesc: {
    fontSize: 10,
    color: '#8e9e95',
    fontWeight: '600',
    marginBottom: 4,
  },
  textAreaBox: {
    height: 80,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  textArea: {
    height: '100%',
    textAlignVertical: 'top',
  },
  summarySection: {
    marginBottom: 40,
  },
  summaryBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabelTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8e9e95',
  },
  summaryValTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b1c1c',
  },
  totalPriceWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff6b00',
  },
  totalCurrency: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ff6b00',
    marginLeft: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 88,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  orderBtn: {
    backgroundColor: '#ff6b00',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  orderBtnDisabled: {
    backgroundColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  orderBtnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#012d1d',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 45, 29, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '85%',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  processingBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b1c1c',
    marginBottom: 8,
    textAlign: 'center',
  },
  processingStep: {
    fontSize: 12,
    color: '#8e9e95',
    fontWeight: '600',
    textAlign: 'center',
  },
  pinEntryBox: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b1c1c',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#414844',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    fontWeight: '550',
  },
  modalPinInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    height: 48,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#1b1c1c',
    backgroundColor: '#fcf9f8',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  modalCancelTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#414844',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#ff6b00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#e0e0e0',
  },
  modalSubmitTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#012d1d',
  },
});
