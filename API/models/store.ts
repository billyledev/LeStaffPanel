import fs from 'fs';
import path from 'path';

import { STORE_FILE } from '@/config';

import mysql from '@/utils/mysql';

function getStoreData() {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, STORE_FILE), 'utf8'));
}

function getItemData(id, items) {
  return items.find(item => item.id === id);
}

function setItem(username, item, data) {
  return new Promise<void>((resolve, reject) => {
    mysql.client.query('INSERT INTO `pendingTransactions` SET ?', {
      username,
      item,
      data,
    }, (error, _results, _fields) => {
      if (error) reject(error);
      resolve();
    });
  });
}

export {
  getStoreData,
  getItemData,
  setItem,
};
