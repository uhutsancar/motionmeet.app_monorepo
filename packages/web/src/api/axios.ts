import axios from 'axios';

import { BASEURL } from '~/config/env';

const api = axios.create({
    baseURL: BASEURL,
    timeout: 30000,
    withCredentials: true,
})

export default api
