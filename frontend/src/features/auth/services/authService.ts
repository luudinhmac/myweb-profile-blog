import api from '@/lib/axios';

export const authService = {
  login: async (formData: Record<string, unknown>, turnstileToken?: string | null) => {
    const headers: Record<string, string> = {};
    if (turnstileToken) {
      headers['x-turnstile-token'] = turnstileToken;
    }
    const response = await api.post('/auth/login', formData, { headers });
    return response.data;
  },

  register: async (formData: Record<string, unknown>, turnstileToken?: string | null) => {
    const headers: Record<string, string> = {};
    if (turnstileToken) {
      headers['x-turnstile-token'] = turnstileToken;
    }
    const response = await api.post('/auth/register', formData, { headers });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  }
};

