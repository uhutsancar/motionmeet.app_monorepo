const { client, endpoints } = require('../api');

describe('Shared API Tests', () => {
  test('API client should be defined', () => {
    expect(client).toBeDefined();
  });

  test('Endpoints should be defined', () => {
    expect(endpoints).toBeDefined();
    expect(endpoints.workouts).toBe('/api/workouts');
    expect(endpoints.users).toBe('/api/users');
  });
});

