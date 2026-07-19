import axios from 'axios';

import { BASEURL } from '~/config/env';

const api = axios.create({
    baseURL: BASEURL
})

export default api