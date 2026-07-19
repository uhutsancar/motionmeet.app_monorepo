import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Stack, Alert, Paper, Link as MuiLink } from '@mui/material';
import { useAuthContext } from '../context/AuthProvider.jsx';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
  const { register } = useAuthContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '', username: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await register(formData);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Signup failed');
    }
    setLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
          Join MotionMeet
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" mb={4}>
          Create an account to start your journey
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Full Name"
              variant="outlined"
              fullWidth
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              variant="outlined"
              fullWidth
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </Stack>
        </form>

        <Typography variant="body2" align="center" sx={{ mt: 3 }}>
          Already have an account?{' '}
          <MuiLink component={Link} to="/sign-in" underline="hover">
            Sign In
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
};

export default Signup;
