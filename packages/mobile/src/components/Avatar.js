import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function Avatar({
  name,
  imageUrl,
  size = 'medium',
  showOnline = false,
  isOnline = false,
}) {
  const sizeStyles = {
    small: { container: 32, text: 14, indicator: 10 },
    medium: { container: 48, text: 20, indicator: 12 },
    large: { container: 72, text: 28, indicator: 16 },
    xlarge: { container: 100, text: 40, indicator: 20 },
  };

  const dimensions = sizeStyles[size];

  const containerStyle = {
    width: dimensions.container,
    height: dimensions.container,
    borderRadius: dimensions.container / 2,
  };

  const textStyle = {
    fontSize: dimensions.text,
  };

  const indicatorStyle = {
    width: dimensions.indicator,
    height: dimensions.indicator,
    borderRadius: dimensions.indicator / 2,
    borderWidth: dimensions.indicator > 12 ? 3 : 2,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {imageUrl ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={[styles.image, containerStyle]}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle]}>
          <Text style={[styles.text, textStyle]}>
            {name ? name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
      )}
      {showOnline && isOnline && (
        <View style={[styles.onlineIndicator, indicatorStyle]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#e5e7eb',
  },
  placeholder: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    borderColor: '#ffffff',
  },
});
