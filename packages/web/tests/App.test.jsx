import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App Component', () => {
  it('renders hello message', () => {
    render(<App />);
    const heading = screen.getByText(/Hello from MotionMeet Web!/i);
    expect(heading).toBeInTheDocument();
  });
});

