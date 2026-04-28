import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

let toastRef = null;

export function showToast(message, type = 'success', duration = 3000) {
  if (toastRef) {
    toastRef.show(message, type, duration);
  }
}

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    toastRef = {
      show: (msg, t, dur) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setMessage(msg);
        setType(t);
        setVisible(true);
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        timerRef.current = setTimeout(() => {
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
            setVisible(false);
          });
        }, dur);
      },
    };
    return () => { toastRef = null; };
  }, []);

  if (!visible) return null;

  const bgColor =
    type === 'danger' ? Colors.dangerBg :
    type === 'warning' ? Colors.warningBg :
    type === 'info' ? Colors.infoBg :
    Colors.successBg;

  const borderColor =
    type === 'danger' ? Colors.danger :
    type === 'warning' ? Colors.warning :
    type === 'info' ? Colors.info :
    Colors.success;

  const icon =
    type === 'danger' ? '❌' :
    type === 'warning' ? '⚠️' :
    type === 'info' ? 'ℹ️' :
    '✅';

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: bgColor, borderLeftColor: borderColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text} numberOfLines={3}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
});
