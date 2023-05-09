import { USERNAME_SUFFIX } from '@/config';

import mysql from '@/utils/mysql';
import mqtt from '@/utils/mqtt';

interface Player {
  username: string;
  rank: number;
  money: number;
  title: string;
  cosmeticsOwned?: string;
  wearing?: string;
}

const playersData: Array<Player> = [];

mqtt.client.on('message', async (topic: string, message: string) => {
  const event = JSON.parse(message);

  switch (event.type) {
    case 'player_rank': {
      const playerData = await getPlayerData(event.username);
      playerData.rank = event.rank;
      break;
    }

    case 'player_connected': {
      getPlayerData(event.username);
      break;
    }

    case 'player_disconnected': {
      clearPlayerData(event.username);
      break;
    }
  }
});

async function getPlayerData(username) {
  let playerData = playersData.find(data => data.username === username);
  
  if (!playerData) {
    playerData = await getPlayerDataFromDB(username);
    playersData.push(playerData);
  }

  return playerData;
}

function clearPlayerData(username) {
  const index = playersData.findIndex(data => data.username === username);

  if (index !== -1) {
    playersData.splice(index, 1);
  }
}

async function validJWTData(data: Player) {
  const serverData = await getPlayerData(data.username);

  if (data.rank !== serverData.rank) {
    return false;
  }

  return true;
}

function getPlayerDataFromDB(username) {
  return new Promise<Player>((resolve, reject) => {
    mysql.client.query({
      sql: 'SELECT * FROM `Players` WHERE `Name` = ?',
      values: [username],
    }, (error, results, _fields) => {
      if (error) reject(error);
      if (results.length == 0) reject(null);
      const rank = results[0].Rank || 0;
      const money = results[0].Money || 0;
      const title = results[0].Title || '';
      const cosmeticsOwned = results[0].CosmeticsOwned || '';
      const wearing = results[0].Wearing || '';
  
      resolve({
        username: username.replace(USERNAME_SUFFIX, ''),
        rank,
        money,
        title,
        cosmeticsOwned,
        wearing,
      });
    });
  });
}

function getRankFromDB(username) {
  return new Promise((resolve, reject) => {
    mysql.client.query({
      sql: 'SELECT Rank FROM `Players` WHERE `Name` = ?',
      values: [username],
    }, (error, results, _fields) => {
      if (error) reject(error);
      if (results.length == 0) reject(null);
      const rank = results[0].Rank || 0;
      resolve(rank);
    });
  });
}

function getUsernameFromCode(code) {
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

function deleteCodeFromDB(username) {
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
  getPlayerData,
  validJWTData,
  getUsernameFromCode,
  deleteCodeFromDB,
  getRankFromDB,
};
