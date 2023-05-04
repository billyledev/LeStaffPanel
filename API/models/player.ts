import { USERNAME_SUFFIX } from '@/config';

import mysql from '@/utils/mysql';

interface Player {
  username: string;
  money: number;
  title: string;
  cosmeticsOwned?: string;
  wearing?: string;
}

function getPlayerInfos(username) {
  return new Promise<Player>((resolve, reject) => {
    mysql.client.query({
      sql: 'SELECT * FROM `Players` WHERE `Name` = ?',
      values: [username],
    }, (error, results, _fields) => {
      if (error) reject(error);
      if (results.length == 0) reject(null);
      const money = results[0].Money || 0;
      const title = results[0].Title || '';
      const cosmeticsOwned = results[0].CosmeticsOwned || '';
      const wearing = results[0].Wearing || '';
  
      resolve({
        username: username.replace(USERNAME_SUFFIX, ''),
        money,
        title,
        cosmeticsOwned,
        wearing,
      });
    });
  });
}

function getCode(code) {
  return new Promise((resolve, reject) => {
    mysql.client.query({
      sql: 'SELECT Name FROM `Players` WHERE `LoginCode` = ?',
      values: [code],
    }, (error, results, _fields) => {
      if (error) reject(error);
      if (results.length === 0) {
        resolve(null);
        return;
      }
      resolve(results[0].Name);
    });
  });
}

function deleteCode(username) {
  return new Promise<void>((resolve, reject) => {
    mysql.client.query('UPDATE Players SET LoginCode = ? WHERE Name = ?', [
      null,
      username,
    ], (error, results, fields) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export {
  getPlayerInfos,
  getCode,
  deleteCode,
};
