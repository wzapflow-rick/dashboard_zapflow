import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NOCODB_URL,
  headers: {
    'xc-token': process.env.NOCODB_TOKEN,
    'Content-Type': 'application/json',
  },
});

export default api;
