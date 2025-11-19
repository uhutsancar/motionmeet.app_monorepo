import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App Component', () => {
  it('renders hello message', () => {
    const { getByText } = render(<App />);
    const title = getByText(/Hello from MotionMeet Mobile!/i);
    expect(title).toBeTruthy();
  });

  it('renders subtitle', () => {
    const { getByText } = render(<App />);
    const subtitle = getByText(/React Native Expo app is running successfully/i);
    expect(subtitle).toBeTruthy();
  });
});

