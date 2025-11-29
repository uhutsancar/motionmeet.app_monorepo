import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';

describe('App Component', () => {
  it('renders home page with MotionMeet title', () => {
    render(<App />);
    const headings = screen.getAllByText(/MotionMeet/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders navigation links', () => {
    render(<App />);
    expect(screen.getAllByText(/Home/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Workouts/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Feed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Messages/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Profile/i).length).toBeGreaterThan(0);
  });
});

