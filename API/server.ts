import fs from 'fs';
import express from 'express';
import https from 'https';
import path from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import {
  API_PORT,
  STATIC_PORT,
  CORS_WHITELIST,
  SKINS_DIR,
  KEY_FILE,
  CERT_FILE,
  CA_FILE,
} from './config';

import logger from '@/utils/logger';
import mysql from '@/utils/mysql';

import players from '@/routes/players';
import store from '@/routes/store';

const limiter = rateLimit({
  windowMs: 60 * 1000, // Length of the time window
  max: 6, // Max requests during the time window
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.',
  },
});

const corsOptions = {
  origin: (origin, callback) => {
    if (CORS_WHITELIST.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
};

const staticServer = express();
staticServer.use('/skins', express.static(path.resolve(__dirname, SKINS_DIR)));
staticServer.listen(STATIC_PORT);

const app = express();
app.use(express.json());
app.use(limiter);
app.use((req, _res, next) => {
  req.headers.origin = req.headers.origin || req.headers.host;
  next();
});
app.use(cors(corsOptions));
app.use('/api/players', players);
app.use('/api/store', store);

/*
  Key generation instructions :

  openssl genrsa -out key.pem 4096
  openssl req -new -key key.pem -out csr.pem
  openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
  rm csr.pem
*/

const serverOptions = {
  key: fs.readFileSync(KEY_FILE, 'utf8'),
  cert: fs.readFileSync(CERT_FILE, 'utf8'),
  ca: fs.readFileSync(CA_FILE, 'utf8'),
};

https.createServer(serverOptions, app).listen(API_PORT);
logger.info(`API running on port ${API_PORT}`);

const exitHandler = async () => {
  return new Promise<void>((resolve, reject) => {
    logger.info('Cleaning up before exiting...');
    mysql.stop();
    resolve();
  });
}

process.stdin.resume();

process.on('exit', exitHandler);

process.on('SIGINT', () => {
  exitHandler().then(() => {
    process.exit();
  });
});

process.on('SIGTERM', () => {
  exitHandler().then(() => {
    process.exit();
  });
});
