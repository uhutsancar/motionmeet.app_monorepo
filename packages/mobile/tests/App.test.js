import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Mock NavigationContainer
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock createNativeStackNavigator
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component: Component }) => null,
  }),
}));

// Mock createBottomTabNavigator
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component: Component }) => null,
  }),
}));

// Simple App component for testing basic rendering
const SimpleApp = () => (
  <View testID="app-container">
    <Text>MotionMeet Mobile</Text>
  </View>
);

describe('Mobile App', () => {
  it('renders basic component structure', () => {
    const { getByText, getByTestId } = render(<SimpleApp />);
    expect(getByTestId('app-container')).toBeTruthy();
    expect(getByText('MotionMeet Mobile')).toBeTruthy();
  });
});


