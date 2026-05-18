import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { Lock, Phone, User } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  const handleLogin = () => {
    if (!phone || !name) return;
    login(phone, name);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Text style={styles.logoText}>RMF</Text>
        </View>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Rwanda Market Facilitator App</Text>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputBox}>
              <User color="#8e9e95" size={16} />
              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor="#8e9e95"
                style={styles.textInput}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Phone Number</Text>
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

          <TouchableOpacity
            style={[styles.loginBtn, (!phone || !name) && styles.loginBtnDisabled]}
            disabled={!phone || !name}
            onPress={handleLogin}
            activeOpacity={0.9}
          >
            <Text style={styles.loginBtnTxt}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#012d1d',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  logoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#012d1d',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b00',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1b1c1c',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8e9e95',
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 28,
  },
  form: {
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
  loginBtn: {
    backgroundColor: '#ff6b00',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  loginBtnDisabled: {
    backgroundColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#012d1d',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
