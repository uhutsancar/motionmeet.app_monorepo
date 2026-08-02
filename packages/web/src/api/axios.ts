import axios from 'axios';

import { BASEURL } from '~/config/env';

const api = axios.create({
    baseURL: BASEURL,
    timeout: 30000,
    withCredentials: true,
})

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
api.interceptors.request.use((request) => {
    const method = request.method?.toUpperCase();
    if (method && !SAFE_METHODS.has(method)) {
        request.headers.set('X-CSRF-Protection', '1');
    }
    return request;
});

export default api
